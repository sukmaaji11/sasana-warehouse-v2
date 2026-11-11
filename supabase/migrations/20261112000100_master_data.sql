-- =====================================================================
-- PHASE 2 — MASTER DATA
-- items, item_units, product_packagings, vendors, buyers,
-- manajemen user (RPC), helper role.
-- Keputusan: Q6 (packaging diinput per base unit), Q7 (1:1), Q14 (master buyer),
-- Q15 (vendor dikelola SO/OWNER_PABRIK/ADMIN_GUDANG), Q19 (daftar produk).
-- =====================================================================

create type public.item_type as enum ('PACKAGING', 'FINISHED_GOOD');

-- ---------------------------------------------------------------------
-- HELPER: role check
-- ---------------------------------------------------------------------
create function app.has_role(variadic p_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.my_role() = any (p_roles), false);
$$;
revoke all on function app.has_role(public.user_role[]) from public;
grant execute on function app.has_role(public.user_role[]) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- ITEMS
-- ---------------------------------------------------------------------
create table public.items (
  id          uuid primary key default gen_random_uuid(),
  sku         text not null unique check (sku ~ '^[A-Z0-9-]{2,30}$'),
  name        text not null check (length(trim(name)) > 0),
  type        public.item_type not null,
  base_unit   text not null check (base_unit ~ '^[a-z][a-z0-9 ]{0,19}$'),
  min_stock   bigint not null default 50 check (min_stock >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on column public.items.base_unit is 'Satuan terkecil, huruf kecil (sachet, botol, karton). Semua qty disimpan dalam satuan ini.';
create unique index items_name_unique on public.items (lower(btrim(name)));
create index items_type_idx on public.items (type) where is_active;

create trigger items_touch before update on public.items
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- ITEM UNITS (konversi satuan; prompt: product_units)
-- ---------------------------------------------------------------------
create table public.item_units (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items (id),
  unit_name   text not null check (unit_name ~ '^[a-z][a-z0-9 ]{0,19}$'),
  factor      integer not null check (factor > 0),
  is_base     boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (item_id, unit_name),
  check (not is_base or factor = 1)
);
create unique index item_units_one_base on public.item_units (item_id) where is_base;

create trigger item_units_touch before update on public.item_units
  for each row execute function app.touch_updated_at();

-- Base unit selalu ada dan mengikuti items.base_unit.
create function app.sync_base_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.item_units (item_id, unit_name, factor, is_base)
    values (new.id, new.base_unit, 1, true);
  elsif new.base_unit is distinct from old.base_unit then
    update public.item_units set unit_name = new.base_unit
     where item_id = new.id and is_base;
  end if;
  return new;
end;
$$;
create trigger items_sync_base_unit after insert or update of base_unit on public.items
  for each row execute function app.sync_base_unit();

-- Base unit tidak boleh diubah/dinonaktifkan langsung.
create function app.guard_base_unit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_base and (new.factor <> 1 or not new.is_active or not new.is_base) then
    raise exception 'BASE_UNIT_LOCKED: satuan dasar tidak bisa diubah faktornya atau dinonaktifkan';
  end if;
  if new.is_base and not old.is_base then
    raise exception 'BASE_UNIT_LOCKED: satuan dasar ditentukan dari data item';
  end if;
  return new;
end;
$$;
create trigger item_units_guard_base before update on public.item_units
  for each row execute function app.guard_base_unit();

-- ---------------------------------------------------------------------
-- PRODUCT PACKAGINGS (MVP: 1 produk jadi → 1 packaging utama, rasio 1:1)
-- ---------------------------------------------------------------------
create table public.product_packagings (
  finished_item_id   uuid primary key references public.items (id),
  packaging_item_id  uuid not null references public.items (id),
  updated_by         uuid references public.profiles (id),
  updated_at         timestamptz not null default now(),
  check (finished_item_id <> packaging_item_id)
);
create index product_packagings_packaging_idx on public.product_packagings (packaging_item_id);

create function app.validate_product_packaging()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select type from public.items where id = new.finished_item_id) <> 'FINISHED_GOOD' then
    raise exception 'INVALID_ITEM_TYPE: produk harus bertipe FINISHED_GOOD';
  end if;
  if (select type from public.items where id = new.packaging_item_id) <> 'PACKAGING' then
    raise exception 'INVALID_ITEM_TYPE: packaging harus bertipe PACKAGING';
  end if;
  new.updated_by := app.uid();
  new.updated_at := now();
  return new;
end;
$$;
create trigger product_packagings_validate before insert or update on public.product_packagings
  for each row execute function app.validate_product_packaging();

-- Tipe item tidak boleh diubah jika sudah dipakai di mapping packaging.
create function app.guard_item_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type is distinct from old.type and exists (
    select 1 from public.product_packagings
     where finished_item_id = new.id or packaging_item_id = new.id
  ) then
    raise exception 'ITEM_TYPE_LOCKED: tipe item sudah dipakai di mapping packaging';
  end if;
  return new;
end;
$$;
create trigger items_guard_type before update of type on public.items
  for each row execute function app.guard_item_type();

-- ---------------------------------------------------------------------
-- VENDORS & BUYERS (nama unik, tidak case-sensitive, mencegah duplikasi)
-- ---------------------------------------------------------------------
create table public.vendors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  phone       text,
  address     text,
  notes       text,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles (id) default app.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index vendors_name_unique on public.vendors (lower(btrim(name)));
create trigger vendors_touch before update on public.vendors
  for each row execute function app.touch_updated_at();

create table public.buyers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  phone       text,
  address     text,
  notes       text,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles (id) default app.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index buyers_name_unique on public.buyers (lower(btrim(name)));
create trigger buyers_touch before update on public.buyers
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- AUDIT
-- ---------------------------------------------------------------------
create trigger items_audit after insert or update or delete on public.items
  for each row execute function app.audit_row();
create trigger item_units_audit after insert or update or delete on public.item_units
  for each row execute function app.audit_row();
create trigger vendors_audit after insert or update or delete on public.vendors
  for each row execute function app.audit_row();
create trigger buyers_audit after insert or update or delete on public.buyers
  for each row execute function app.audit_row();

-- product_packagings tidak punya kolom id → audit khusus.
create function app.audit_product_packaging()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    app.uid(),
    'PRODUCT_PACKAGINGS_' || tg_op,
    'product_packagings',
    coalesce(new.finished_item_id, old.finished_item_id)::text,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;
create trigger product_packagings_audit after insert or update or delete on public.product_packagings
  for each row execute function app.audit_product_packaging();

revoke all on function app.sync_base_unit(), app.guard_base_unit(), app.validate_product_packaging(),
  app.guard_item_type(), app.audit_product_packaging() from public;

-- ---------------------------------------------------------------------
-- GRANTS (tidak ada DELETE: master data dinonaktifkan, bukan dihapus)
-- ---------------------------------------------------------------------
revoke all on public.items, public.item_units, public.product_packagings, public.vendors, public.buyers
  from anon, authenticated;
grant select on public.items, public.item_units, public.product_packagings, public.vendors, public.buyers
  to authenticated;
grant insert, update on public.items, public.item_units, public.product_packagings, public.vendors, public.buyers
  to authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.items enable row level security;
alter table public.item_units enable row level security;
alter table public.product_packagings enable row level security;
alter table public.vendors enable row level security;
alter table public.buyers enable row level security;

-- Katalog item: semua user aktif boleh baca (driver perlu nama barang di shipment).
create policy items_select on public.items for select to authenticated
  using ((select app.my_role()) is not null);
create policy items_insert on public.items for insert to authenticated
  with check ((select app.is_super_owner()));
create policy items_update on public.items for update to authenticated
  using ((select app.is_super_owner())) with check ((select app.is_super_owner()));

create policy item_units_select on public.item_units for select to authenticated
  using ((select app.my_role()) is not null);
create policy item_units_insert on public.item_units for insert to authenticated
  with check ((select app.is_super_owner()));
create policy item_units_update on public.item_units for update to authenticated
  using ((select app.is_super_owner())) with check ((select app.is_super_owner()));

create policy product_packagings_select on public.product_packagings for select to authenticated
  using ((select app.my_role()) is not null);
create policy product_packagings_insert on public.product_packagings for insert to authenticated
  with check ((select app.is_super_owner()));
create policy product_packagings_update on public.product_packagings for update to authenticated
  using ((select app.is_super_owner())) with check ((select app.is_super_owner()));

-- Vendor: dibaca & dikelola SO, OWNER_PABRIK, ADMIN_GUDANG (Q15). Driver tidak.
create policy vendors_select on public.vendors for select to authenticated
  using ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK')));
create policy vendors_insert on public.vendors for insert to authenticated
  with check ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK')));
create policy vendors_update on public.vendors for update to authenticated
  using ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK')))
  with check ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK')));

-- Buyer: sama dengan vendor (Q14; pengelola = role yang melakukan distribusi).
create policy buyers_select on public.buyers for select to authenticated
  using ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK')));
create policy buyers_insert on public.buyers for insert to authenticated
  with check ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK')));
create policy buyers_update on public.buyers for update to authenticated
  using ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK')))
  with check ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK')));

-- Profiles: SO boleh baca semua (Phase 1). Admin Gudang & Owner Pabrik perlu
-- melihat DRIVER aktif untuk assign shipment (Phase 4).
create policy profiles_select_drivers on public.profiles for select to authenticated
  using (
    role = 'DRIVER' and is_active
    and (select app.has_role('ADMIN_GUDANG', 'OWNER_PABRIK'))
  );
-- Tidak ada grant/policy UPDATE untuk profiles: perubahan lewat RPC admin_update_user.

-- ---------------------------------------------------------------------
-- RPC: kelola user (SUPER_OWNER). Pembuatan akun & reset password
-- butuh Auth Admin API → Edge Function `admin-users`.
-- ---------------------------------------------------------------------
create function public.admin_update_user(
  p_user_id uuid,
  p_full_name text,
  p_role public.user_role,
  p_is_active boolean,
  p_location_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.uid();
  v_old public.profiles;
begin
  if not app.is_super_owner() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'NOT_FOUND: user tidak ditemukan';
  end if;

  if length(trim(coalesce(p_full_name, ''))) = 0 then
    raise exception 'VALIDATION: nama wajib diisi';
  end if;

  -- Cegah Super Owner mengunci dirinya sendiri.
  if p_user_id = v_me and (p_role <> 'SUPER_OWNER' or not p_is_active) then
    raise exception 'SELF_LOCKOUT: tidak bisa menurunkan role atau menonaktifkan akun sendiri';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_location_ids, '{}')) l(id)
     where not exists (select 1 from public.locations x where x.id = l.id and x.deleted_at is null)
  ) then
    raise exception 'VALIDATION: lokasi tidak valid';
  end if;

  update public.profiles
     set full_name = trim(p_full_name), role = p_role, is_active = p_is_active
   where id = p_user_id;

  delete from public.user_locations
   where user_id = p_user_id
     and location_id <> all (coalesce(p_location_ids, '{}'));

  insert into public.user_locations (user_id, location_id, created_by)
  select p_user_id, l.id, v_me
    from unnest(coalesce(p_location_ids, '{}')) l(id)
  on conflict do nothing;
end;
$$;
revoke all on function public.admin_update_user(uuid, text, public.user_role, boolean, uuid[]) from public, anon;
grant execute on function public.admin_update_user(uuid, text, public.user_role, boolean, uuid[]) to authenticated;
