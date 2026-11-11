-- =====================================================================
-- PHASE 1 — FOUNDATION
-- profiles, locations, user_locations, audit_logs, helper otorisasi, RLS.
-- Lihat docs/phase-0/PHASE-0-DISCOVERY.md §4–§6.
-- =====================================================================

-- Schema untuk helper internal (tidak diekspos lewat PostgREST).
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------
-- ENUMS (enum fase berikutnya ditambahkan di migration masing-masing)
-- ---------------------------------------------------------------------
create type public.user_role as enum ('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'DRIVER');
create type public.location_type as enum ('WAREHOUSE', 'FACTORY', 'SALES_WAREHOUSE');

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
create function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- LOCATIONS
-- ---------------------------------------------------------------------
create table public.locations (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[A-Z0-9-]{2,20}$'),
  name            text not null check (length(trim(name)) > 0),
  address         text,
  type            public.location_type not null,
  is_inbound_hub  boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
comment on column public.locations.is_inbound_hub is
  'Tujuan default inbound vendor (Gudang Rumah). Hanya satu lokasi aktif.';

create unique index locations_one_inbound_hub
  on public.locations (is_inbound_hub)
  where is_inbound_hub and deleted_at is null;

create trigger locations_touch before update on public.locations
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete restrict,
  username    text not null unique check (username ~ '^[a-z0-9._]{3,30}$'),
  full_name   text not null check (length(trim(full_name)) > 0),
  email       text,
  role        public.user_role not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on column public.profiles.email is
  'Email kontak opsional. Login memakai email sintetis <username>@users.sasana.internal di auth.users.';

create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- USER ↔ LOCATION
-- ---------------------------------------------------------------------
create table public.user_locations (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  location_id uuid not null references public.locations (id),
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id),
  primary key (user_id, location_id)
);
create index user_locations_location_idx on public.user_locations (location_id);

-- ---------------------------------------------------------------------
-- AUDIT LOGS (append-only)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  table_name  text not null,
  record_id   text not null,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_time_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------
-- HELPERS OTORISASI
-- Semua akses ke auth.uid() melewati app.uid() supaya mudah dipindah
-- ke Postgres non-Supabase (Decision Log: Hosting).
-- ---------------------------------------------------------------------
create function app.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select auth.uid();
$$;

-- Role user aktif. NULL jika tidak login, tidak punya profil, atau nonaktif.
create function app.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = app.uid()
    and p.is_active;
$$;

create function app.is_super_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.my_role() = 'SUPER_OWNER', false);
$$;

-- True jika user aktif boleh mengakses lokasi: SUPER_OWNER, atau di-assign.
create function app.has_location(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_super_owner()
      or (
        app.my_role() is not null
        and exists (
          select 1
          from public.user_locations ul
          where ul.user_id = app.uid()
            and ul.location_id = p_location_id
        )
      );
$$;

revoke all on all functions in schema app from public;
grant execute on function app.uid(), app.my_role(), app.is_super_owner(), app.has_location(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- AUDIT TRIGGER (master data)
-- ---------------------------------------------------------------------
create function app.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    app.uid(),
    upper(tg_table_name) || '_' || tg_op,
    tg_table_name,
    coalesce(v_row ->> 'id', (v_row ->> 'user_id') || ':' || (v_row ->> 'location_id')),
    v_old,
    v_new
  );
  return coalesce(new, old);
end;
$$;
revoke all on function app.audit_row() from public;

create trigger locations_audit after insert or update or delete on public.locations
  for each row execute function app.audit_row();
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function app.audit_row();
create trigger user_locations_audit after insert or update or delete on public.user_locations
  for each row execute function app.audit_row();

-- ---------------------------------------------------------------------
-- RPC: konteks user yang sedang login (dipakai Android & web setelah login)
-- Mengembalikan profil walaupun nonaktif, supaya app bisa menampilkan
-- layar "Akun nonaktif". Lokasi hanya dikembalikan untuk user aktif.
-- ---------------------------------------------------------------------
create function public.get_my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_profile public.profiles;
  v_locations jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_profile.is_active then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', l.id, 'code', l.code, 'name', l.name, 'type', l.type
           ) order by l.name), '[]'::jsonb)
      into v_locations
      from public.locations l
     where l.deleted_at is null
       and l.is_active
       and (v_profile.role = 'SUPER_OWNER'
            or exists (select 1 from public.user_locations ul
                        where ul.user_id = v_uid and ul.location_id = l.id));
  else
    v_locations := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'id', v_profile.id,
    'username', v_profile.username,
    'full_name', v_profile.full_name,
    'role', v_profile.role,
    'is_active', v_profile.is_active,
    'locations', v_locations
  );
end;
$$;
revoke all on function public.get_my_context() from public, anon;
grant execute on function public.get_my_context() to authenticated;

-- ---------------------------------------------------------------------
-- GRANTS — anon tidak boleh apa pun; authenticated sebatas yang dibutuhkan.
-- ---------------------------------------------------------------------
revoke all on public.locations, public.profiles, public.user_locations, public.audit_logs
  from anon, authenticated;

grant select on public.locations, public.profiles, public.user_locations, public.audit_logs
  to authenticated;
grant insert, update on public.locations to authenticated;          -- dibatasi RLS: SUPER_OWNER
grant insert, delete on public.user_locations to authenticated;     -- dibatasi RLS: SUPER_OWNER
-- profiles ditulis oleh Edge Function (service role) — Phase 2.
-- audit_logs hanya ditulis oleh trigger/RPC.

-- Default untuk tabel baru: jangan otomatis terbuka ke anon/authenticated.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, public;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.user_locations enable row level security;
alter table public.audit_logs enable row level security;

-- locations
create policy locations_select on public.locations
  for select to authenticated
  using ((select app.my_role()) is not null);

create policy locations_insert on public.locations
  for insert to authenticated
  with check ((select app.is_super_owner()));

create policy locations_update on public.locations
  for update to authenticated
  using ((select app.is_super_owner()))
  with check ((select app.is_super_owner()));

-- profiles: diri sendiri (walau nonaktif) atau SUPER_OWNER
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select app.uid()) or (select app.is_super_owner()));

-- user_locations
create policy user_locations_select on public.user_locations
  for select to authenticated
  using (user_id = (select app.uid()) or (select app.is_super_owner()));

create policy user_locations_insert on public.user_locations
  for insert to authenticated
  with check ((select app.is_super_owner()));

create policy user_locations_delete on public.user_locations
  for delete to authenticated
  using ((select app.is_super_owner()));

-- audit_logs
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using ((select app.is_super_owner()));
