-- =====================================================================
-- PHASE 4 — SHIPMENT (perpindahan barang INTERNAL antar lokasi)
-- Keputusan: Q4 (packaging & produk jadi, antar lokasi internal; keluar ke
-- pihak luar lewat Distribusi), Q3 (batal kirim setelah pickup oleh SO →
-- SHIPMENT_RETURN), Q12 (driver bisa diganti/dilepas sebelum pickup; opsi
-- pickup atas nama driver oleh admin lokasi asal).
--
-- Status: CREATED → ASSIGNED → PICKED_UP → RECEIVED; CANCELLED.
--   create / assign : stok tidak berubah
--   pickup          : stok asal berkurang (validasi stok di sini)
--   receive         : stok tujuan bertambah (receive selalu penuh)
-- =====================================================================

create type public.shipment_status as enum ('CREATED', 'ASSIGNED', 'PICKED_UP', 'RECEIVED', 'CANCELLED');

create table public.shipments (
  id                 uuid primary key default gen_random_uuid(),
  doc_no             text not null unique,
  from_location_id   uuid not null references public.locations (id),
  to_location_id     uuid not null references public.locations (id),
  status             public.shipment_status not null default 'CREATED',
  driver_id          uuid references public.profiles (id),
  notes              text,
  idempotency_key    uuid not null unique,
  created_by         uuid not null references public.profiles (id),
  created_at         timestamptz not null default now(),
  assigned_by        uuid references public.profiles (id),
  assigned_at        timestamptz,
  picked_up_by       uuid references public.profiles (id),
  picked_up_at       timestamptz,
  picked_up_on_behalf boolean not null default false,
  received_by        uuid references public.profiles (id),
  received_at        timestamptz,
  cancelled_by       uuid references public.profiles (id),
  cancelled_at       timestamptz,
  cancel_reason      text,
  updated_at         timestamptz not null default now(),
  check (from_location_id <> to_location_id),
  check (status not in ('ASSIGNED', 'PICKED_UP', 'RECEIVED') or driver_id is not null),
  check (status not in ('PICKED_UP', 'RECEIVED') or (picked_up_at is not null and picked_up_by is not null)),
  check (status <> 'RECEIVED' or (received_at is not null and received_by is not null)),
  check (status <> 'CANCELLED' or (cancelled_at is not null and length(trim(cancel_reason)) > 0))
);
create index shipments_status_idx on public.shipments (status, created_at desc);
create index shipments_driver_idx on public.shipments (driver_id, status);
create index shipments_from_idx on public.shipments (from_location_id, created_at desc);
create index shipments_to_idx on public.shipments (to_location_id, created_at desc);

create trigger shipments_touch before update on public.shipments
  for each row execute function app.touch_updated_at();

create table public.shipment_items (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid not null references public.shipments (id),
  item_id      uuid not null references public.items (id),
  unit_id      uuid not null references public.item_units (id),
  unit_name    text not null,
  input_qty    integer not null check (input_qty > 0),
  factor       integer not null check (factor > 0),
  base_qty     bigint generated always as (input_qty::bigint * factor) stored,
  unique (shipment_id, item_id)
);

-- ---------------------------------------------------------------------
-- HELPER
-- ---------------------------------------------------------------------
-- Pengelola shipment di lokasi asal: SO, atau AG/OP yang di-assign ke lokasi asal.
create function app.can_manage_shipment_origin(p_from uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_super_owner()
      or (app.has_role('ADMIN_GUDANG', 'OWNER_PABRIK') and app.has_location(p_from));
$$;

create function app.assert_driver(p_driver_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = p_driver_id and role = 'DRIVER' and is_active) then
    raise exception 'VALIDATION: driver tidak valid atau nonaktif';
  end if;
end;
$$;

create function app.shipment_audit(p_action text, p_id uuid, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (app.uid(), p_action, 'shipments', p_id::text, p_data);
$$;

-- ---------------------------------------------------------------------
-- CREATE (stok tidak berubah). Driver opsional → langsung ASSIGNED.
-- ---------------------------------------------------------------------
create function public.create_shipment(
  p_idempotency_key uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_driver_id uuid,
  p_notes text,
  p_items jsonb -- [{item_id, unit_id, qty}]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_existing public.shipments;
  v_id uuid;
  v_doc text;
  v_line record;
  v_count int;
begin
  if p_idempotency_key is null then
    raise exception 'VALIDATION: idempotency key wajib';
  end if;
  select * into v_existing from public.shipments where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.created_by <> v_uid then
      raise exception 'VALIDATION: idempotency key sudah dipakai';
    end if;
    return jsonb_build_object('id', v_existing.id, 'doc_no', v_existing.doc_no, 'replayed', true);
  end if;

  if not app.can_manage_shipment_origin(p_from_location_id) then
    raise exception 'FORBIDDEN_LOCATION';
  end if;
  if p_from_location_id = p_to_location_id then
    raise exception 'VALIDATION: lokasi asal dan tujuan tidak boleh sama';
  end if;
  if not exists (select 1 from public.locations where id = p_from_location_id and is_active and deleted_at is null)
     or not exists (select 1 from public.locations where id = p_to_location_id and is_active and deleted_at is null) then
    raise exception 'VALIDATION: lokasi asal/tujuan tidak valid atau nonaktif';
  end if;
  if p_driver_id is not null then
    perform app.assert_driver(p_driver_id);
  end if;

  -- Validasi baris: barang aktif (packaging atau produk jadi) & satuannya.
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'VALIDATION: minimal satu barang';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'VALIDATION: maksimal 100 baris barang';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) l
     where (l ->> 'qty') is null or (l ->> 'qty') !~ '^[0-9]+$' or (l ->> 'qty')::bigint <= 0
        or (l ->> 'qty')::bigint > 100000000
        or not exists (
          select 1 from public.items i join public.item_units u on u.item_id = i.id
           where i.id = (l ->> 'item_id')::uuid and i.is_active
             and u.id = (l ->> 'unit_id')::uuid and u.is_active
        )
  ) then
    raise exception 'VALIDATION: barang/satuan tidak valid atau jumlah bukan bilangan bulat > 0';
  end if;
  select count(distinct l ->> 'item_id') into v_count from jsonb_array_elements(p_items) l;
  if v_count <> jsonb_array_length(p_items) then
    raise exception 'VALIDATION: barang yang sama tidak boleh muncul dua kali';
  end if;

  v_doc := app.next_doc_no('SHP');
  insert into public.shipments (
    doc_no, from_location_id, to_location_id, status, driver_id, notes, idempotency_key, created_by,
    assigned_by, assigned_at
  ) values (
    v_doc, p_from_location_id, p_to_location_id,
    case when p_driver_id is null then 'CREATED'::public.shipment_status else 'ASSIGNED'::public.shipment_status end,
    p_driver_id, nullif(trim(p_notes), ''), p_idempotency_key, v_uid,
    case when p_driver_id is null then null else v_uid end,
    case when p_driver_id is null then null else now() end
  )
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select * into v_existing from public.shipments where idempotency_key = p_idempotency_key;
    return jsonb_build_object('id', v_existing.id, 'doc_no', v_existing.doc_no, 'replayed', true);
  end if;

  for v_line in
    select (l ->> 'item_id')::uuid as item_id, u.id as unit_id, u.unit_name, (l ->> 'qty')::integer as qty, u.factor
      from jsonb_array_elements(p_items) l
      join public.item_units u on u.id = (l ->> 'unit_id')::uuid
  loop
    insert into public.shipment_items (shipment_id, item_id, unit_id, unit_name, input_qty, factor)
    values (v_id, v_line.item_id, v_line.unit_id, v_line.unit_name, v_line.qty, v_line.factor);
  end loop;

  perform app.shipment_audit('SHIPMENT_CREATED', v_id,
    jsonb_build_object('doc_no', v_doc, 'from', p_from_location_id, 'to', p_to_location_id, 'driver_id', p_driver_id, 'items', p_items));
  return jsonb_build_object('id', v_id, 'doc_no', v_doc, 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- ASSIGN / GANTI / LEPAS DRIVER (Q12) — hanya sebelum pickup
-- p_driver_id null = lepas driver → CREATED
-- ---------------------------------------------------------------------
create function public.assign_shipment_driver(p_shipment_id uuid, p_driver_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_s public.shipments;
begin
  select * into v_s from public.shipments where id = p_shipment_id for update;
  if not found then
    raise exception 'NOT_FOUND: shipment tidak ditemukan';
  end if;
  if not app.can_manage_shipment_origin(v_s.from_location_id) then
    raise exception 'FORBIDDEN_LOCATION';
  end if;
  if v_s.status not in ('CREATED', 'ASSIGNED') then
    raise exception 'INVALID_STATUS: driver hanya bisa diatur sebelum pickup';
  end if;
  if v_s.driver_id is not distinct from p_driver_id then
    return jsonb_build_object('doc_no', v_s.doc_no, 'status', v_s.status, 'replayed', true);
  end if;
  if p_driver_id is not null then
    perform app.assert_driver(p_driver_id);
  end if;

  update public.shipments
     set driver_id = p_driver_id,
         status = case when p_driver_id is null then 'CREATED'::public.shipment_status else 'ASSIGNED'::public.shipment_status end,
         assigned_by = case when p_driver_id is null then null else v_uid end,
         assigned_at = case when p_driver_id is null then null else now() end
   where id = p_shipment_id;

  perform app.shipment_audit(
    case when p_driver_id is null then 'SHIPMENT_DRIVER_REMOVED' else 'SHIPMENT_DRIVER_ASSIGNED' end,
    p_shipment_id, jsonb_build_object('doc_no', v_s.doc_no, 'old_driver_id', v_s.driver_id, 'driver_id', p_driver_id));
  return jsonb_build_object('doc_no', v_s.doc_no,
    'status', case when p_driver_id is null then 'CREATED' else 'ASSIGNED' end, 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- PICKUP — stok asal berkurang. Oleh driver yang ditugaskan, atau (opsi Q12)
-- oleh pengelola lokasi asal atas nama driver.
-- ---------------------------------------------------------------------
create function public.pickup_shipment(p_shipment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_s public.shipments;
  v_on_behalf boolean;
  v_line record;
begin
  select * into v_s from public.shipments where id = p_shipment_id for update;
  if not found then
    raise exception 'NOT_FOUND: shipment tidak ditemukan';
  end if;

  if v_s.driver_id = v_uid and app.has_role('DRIVER') then
    v_on_behalf := false;
  elsif app.can_manage_shipment_origin(v_s.from_location_id) then
    v_on_behalf := true;
  else
    raise exception 'FORBIDDEN';
  end if;

  -- Retry aman: pickup yang sudah terjadi tidak diulang.
  if v_s.status in ('PICKED_UP', 'RECEIVED') then
    return jsonb_build_object('doc_no', v_s.doc_no, 'status', v_s.status, 'replayed', true);
  end if;
  if v_s.status <> 'ASSIGNED' then
    raise exception 'INVALID_STATUS: shipment harus berstatus ASSIGNED (sudah ada driver) untuk pickup';
  end if;

  for v_line in
    select item_id, base_qty from public.shipment_items where shipment_id = p_shipment_id order by item_id
  loop
    perform app.apply_stock_delta(
      v_line.item_id, v_s.from_location_id, -v_line.base_qty, 'SHIPMENT_PICKUP',
      'shipment', p_shipment_id, v_s.doc_no, v_s.from_location_id, v_s.to_location_id
    );
  end loop;

  update public.shipments
     set status = 'PICKED_UP', picked_up_by = v_uid, picked_up_at = now(), picked_up_on_behalf = v_on_behalf
   where id = p_shipment_id;

  perform app.shipment_audit('SHIPMENT_PICKED_UP', p_shipment_id,
    jsonb_build_object('doc_no', v_s.doc_no, 'driver_id', v_s.driver_id, 'on_behalf', v_on_behalf));
  return jsonb_build_object('doc_no', v_s.doc_no, 'status', 'PICKED_UP', 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- RECEIVE — stok tujuan bertambah. SO, atau AG/OP yang di-assign ke tujuan.
-- Driver tidak boleh receive (MVP).
-- ---------------------------------------------------------------------
create function public.receive_shipment(p_shipment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_s public.shipments;
  v_line record;
begin
  if not app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK') then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_s from public.shipments where id = p_shipment_id for update;
  if not found then
    raise exception 'NOT_FOUND: shipment tidak ditemukan';
  end if;
  perform app.assert_location_access(v_s.to_location_id);

  if v_s.status = 'RECEIVED' then
    return jsonb_build_object('doc_no', v_s.doc_no, 'status', v_s.status, 'replayed', true);
  end if;
  if v_s.status <> 'PICKED_UP' then
    raise exception 'INVALID_STATUS: shipment belum di-pickup atau sudah dibatalkan';
  end if;

  for v_line in
    select item_id, base_qty from public.shipment_items where shipment_id = p_shipment_id order by item_id
  loop
    perform app.apply_stock_delta(
      v_line.item_id, v_s.to_location_id, v_line.base_qty, 'SHIPMENT_RECEIVE',
      'shipment', p_shipment_id, v_s.doc_no, v_s.from_location_id, v_s.to_location_id
    );
  end loop;

  update public.shipments set status = 'RECEIVED', received_by = v_uid, received_at = now() where id = p_shipment_id;

  perform app.shipment_audit('SHIPMENT_RECEIVED', p_shipment_id, jsonb_build_object('doc_no', v_s.doc_no));
  return jsonb_build_object('doc_no', v_s.doc_no, 'status', 'RECEIVED', 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- CANCEL
--   CREATED/ASSIGNED : SO atau pengelola lokasi asal (stok tidak berubah)
--   PICKED_UP        : SO saja → stok kembali ke asal (SHIPMENT_RETURN, Q3)
--   RECEIVED         : tidak bisa (koreksi lewat shipment balik/penyesuaian)
-- ---------------------------------------------------------------------
create function public.cancel_shipment(p_shipment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_s public.shipments;
  v_line record;
begin
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'VALIDATION: alasan pembatalan wajib diisi';
  end if;
  select * into v_s from public.shipments where id = p_shipment_id for update;
  if not found then
    raise exception 'NOT_FOUND: shipment tidak ditemukan';
  end if;

  if v_s.status = 'CANCELLED' then
    return jsonb_build_object('doc_no', v_s.doc_no, 'status', v_s.status, 'replayed', true);
  end if;
  if v_s.status = 'RECEIVED' then
    raise exception 'INVALID_STATUS: shipment yang sudah diterima tidak bisa dibatalkan';
  end if;

  if v_s.status = 'PICKED_UP' then
    if not app.is_super_owner() then
      raise exception 'FORBIDDEN: hanya Super Owner yang bisa membatalkan shipment yang sudah di-pickup';
    end if;
    for v_line in
      select item_id, base_qty from public.shipment_items where shipment_id = p_shipment_id order by item_id
    loop
      perform app.apply_stock_delta(
        v_line.item_id, v_s.from_location_id, v_line.base_qty, 'SHIPMENT_RETURN',
        'shipment', p_shipment_id, v_s.doc_no, v_s.to_location_id, v_s.from_location_id
      );
    end loop;
  elsif not app.can_manage_shipment_origin(v_s.from_location_id) then
    raise exception 'FORBIDDEN_LOCATION';
  end if;

  update public.shipments
     set status = 'CANCELLED', cancelled_by = v_uid, cancelled_at = now(), cancel_reason = trim(p_reason)
   where id = p_shipment_id;

  perform app.shipment_audit('SHIPMENT_CANCELLED', p_shipment_id,
    jsonb_build_object('doc_no', v_s.doc_no, 'from_status', v_s.status, 'reason', p_reason));
  return jsonb_build_object('doc_no', v_s.doc_no, 'status', 'CANCELLED', 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- RLS: SO semua; AG/OP jika lokasi asal atau tujuan di-assign; DRIVER hanya miliknya.
-- ---------------------------------------------------------------------
revoke all on public.shipments, public.shipment_items from anon, authenticated;
grant select on public.shipments, public.shipment_items to authenticated;
alter table public.shipments enable row level security;
alter table public.shipment_items enable row level security;

create policy shipments_select on public.shipments for select to authenticated
  using (
    (select app.is_super_owner())
    or ((select app.has_role('ADMIN_GUDANG', 'OWNER_PABRIK'))
        and (app.has_location(from_location_id) or app.has_location(to_location_id)))
    or ((select app.has_role('DRIVER')) and driver_id = (select app.uid()))
  );
create policy shipment_items_select on public.shipment_items for select to authenticated
  using (exists (select 1 from public.shipments s where s.id = shipment_id));

-- Driver perlu nama pembuat/pengelola? Tidak. Pengelola perlu nama driver: sudah via profiles_select_drivers.

revoke all on function app.can_manage_shipment_origin(uuid), app.assert_driver(uuid),
  app.shipment_audit(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.create_shipment(uuid, uuid, uuid, uuid, text, jsonb),
  public.assign_shipment_driver(uuid, uuid), public.pickup_shipment(uuid), public.receive_shipment(uuid),
  public.cancel_shipment(uuid, text) from public, anon;
grant execute on function public.create_shipment(uuid, uuid, uuid, uuid, text, jsonb),
  public.assign_shipment_driver(uuid, uuid), public.pickup_shipment(uuid), public.receive_shipment(uuid),
  public.cancel_shipment(uuid, text) to authenticated;
