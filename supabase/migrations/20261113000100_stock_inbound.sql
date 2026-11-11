-- =====================================================================
-- PHASE 3 — STOK, PERGERAKAN STOK, INBOUND, STOK AWAL/PENYESUAIAN, VOID
-- Prinsip:
--  * stocks hanya berubah lewat app.apply_stock_delta (dipanggil RPC).
--  * Setiap perubahan saldo = 1 baris stock_movements (ledger).
--    Invariant: stocks.quantity = SUM(stock_movements.quantity_delta).
--  * Tidak ada stok negatif (CHECK + validasi dengan row lock).
--  * Idempotency key di setiap transaksi; retry mengembalikan hasil pertama.
--  * Tanggal transaksi: maksimal 7 hari ke belakang, tidak boleh masa depan (Q16).
-- =====================================================================

create type public.movement_type as enum (
  'INBOUND',
  'SHIPMENT_PICKUP',
  'SHIPMENT_RECEIVE',
  'SHIPMENT_RETURN',
  'PRODUCTION_CONSUME',
  'PRODUCTION_RESULT',
  'DISTRIBUTION',
  'OPENING_BALANCE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'VOID_REVERSAL'
);

-- ---------------------------------------------------------------------
-- STOCKS & MOVEMENTS
-- ---------------------------------------------------------------------
create table public.stocks (
  item_id      uuid not null references public.items (id),
  location_id  uuid not null references public.locations (id),
  quantity     bigint not null default 0 check (quantity >= 0),
  updated_at   timestamptz not null default now(),
  primary key (item_id, location_id)
);
create index stocks_location_idx on public.stocks (location_id);

create table public.stock_movements (
  id                bigint generated always as identity primary key,
  item_id           uuid not null references public.items (id),
  location_id       uuid not null references public.locations (id),
  quantity_delta    bigint not null check (quantity_delta <> 0),
  balance_after     bigint not null check (balance_after >= 0),
  movement_type     public.movement_type not null,
  from_location_id  uuid references public.locations (id),
  to_location_id    uuid references public.locations (id),
  ref_type          text not null check (ref_type in ('inbound', 'stock_adjustment', 'shipment', 'production', 'distribution')),
  ref_id            uuid not null,
  ref_doc_no        text not null,
  created_by        uuid not null references public.profiles (id),
  created_at        timestamptz not null default now(),
  unique (ref_type, ref_id, movement_type, item_id, location_id)
);
create index stock_movements_item_loc_time_idx on public.stock_movements (item_id, location_id, created_at desc);
create index stock_movements_loc_time_idx on public.stock_movements (location_id, created_at desc);
create index stock_movements_ref_idx on public.stock_movements (ref_type, ref_id);

-- ---------------------------------------------------------------------
-- NOMOR DOKUMEN: PREFIX-YYYYMM-0001 (zona Asia/Jakarta)
-- ---------------------------------------------------------------------
create table public.doc_counters (
  prefix   text not null,
  period   text not null,
  last_no  integer not null default 0,
  primary key (prefix, period)
);

create function app.next_doc_no(p_prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period text := to_char(now() at time zone 'Asia/Jakarta', 'YYYYMM');
  v_no integer;
begin
  insert into public.doc_counters (prefix, period, last_no) values (p_prefix, v_period, 1)
  on conflict (prefix, period) do update set last_no = public.doc_counters.last_no + 1
  returning last_no into v_no;
  return p_prefix || '-' || v_period || '-' || lpad(v_no::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- HELPER VALIDASI
-- ---------------------------------------------------------------------
create function app.today_wib()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

-- Q16: maksimal 7 hari ke belakang, tidak boleh masa depan.
create function app.assert_transaction_date(p_date date)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_date is null then
    raise exception 'VALIDATION: tanggal transaksi wajib diisi';
  end if;
  if p_date > app.today_wib() then
    raise exception 'VALIDATION: tanggal transaksi tidak boleh di masa depan';
  end if;
  if p_date < app.today_wib() - 7 then
    raise exception 'VALIDATION: tanggal transaksi maksimal 7 hari ke belakang';
  end if;
end;
$$;

-- Pastikan user aktif (mengembalikan uid).
create function app.require_active_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if app.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if app.my_role() is null then
    raise exception 'ACCOUNT_INACTIVE';
  end if;
  return app.uid();
end;
$$;

create function app.assert_location_access(p_location_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.has_location(p_location_id) then
    raise exception 'FORBIDDEN_LOCATION';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- INTI: ubah saldo + catat movement (satu-satunya jalan mengubah stok)
-- Wajib dipanggil di dalam transaksi RPC. Mengunci baris stok (FOR UPDATE).
-- Pemanggil wajib memproses item dalam urutan item_id agar tidak deadlock.
-- ---------------------------------------------------------------------
create function app.apply_stock_delta(
  p_item_id uuid,
  p_location_id uuid,
  p_delta bigint,
  p_type public.movement_type,
  p_ref_type text,
  p_ref_id uuid,
  p_ref_doc_no text,
  p_from_location_id uuid default null,
  p_to_location_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qty bigint;
  v_item text;
  v_unit text;
  v_loc text;
begin
  if p_delta = 0 then
    raise exception 'VALIDATION: jumlah tidak boleh nol';
  end if;

  insert into public.stocks (item_id, location_id) values (p_item_id, p_location_id)
  on conflict do nothing;

  select quantity into v_qty
    from public.stocks
   where item_id = p_item_id and location_id = p_location_id
     for update;

  if v_qty + p_delta < 0 then
    select name, base_unit into v_item, v_unit from public.items where id = p_item_id;
    select name into v_loc from public.locations where id = p_location_id;
    raise exception 'INSUFFICIENT_STOCK: stok % di % tidak cukup (tersedia %, dibutuhkan % %)',
      v_item, v_loc, v_qty, -p_delta, v_unit;
  end if;

  update public.stocks
     set quantity = quantity + p_delta, updated_at = now()
   where item_id = p_item_id and location_id = p_location_id
  returning quantity into v_qty;

  insert into public.stock_movements (
    item_id, location_id, quantity_delta, balance_after, movement_type,
    from_location_id, to_location_id, ref_type, ref_id, ref_doc_no, created_by
  ) values (
    p_item_id, p_location_id, p_delta, v_qty, p_type,
    p_from_location_id, p_to_location_id, p_ref_type, p_ref_id, p_ref_doc_no, app.uid()
  );

  return v_qty;
end;
$$;

-- ---------------------------------------------------------------------
-- INBOUND (packaging dari vendor → inbound hub)
-- ---------------------------------------------------------------------
create table public.inbound_transactions (
  id                uuid primary key default gen_random_uuid(),
  doc_no            text not null unique,
  vendor_id         uuid not null references public.vendors (id),
  location_id       uuid not null references public.locations (id),
  transaction_date  date not null,
  notes             text,
  idempotency_key   uuid not null unique,
  created_by        uuid not null references public.profiles (id),
  created_at        timestamptz not null default now(),
  voided_at         timestamptz,
  voided_by         uuid references public.profiles (id),
  void_reason       text,
  check (voided_at is null or (voided_by is not null and length(trim(void_reason)) > 0))
);
create index inbound_loc_date_idx on public.inbound_transactions (location_id, transaction_date desc);

create table public.inbound_items (
  id          uuid primary key default gen_random_uuid(),
  inbound_id  uuid not null references public.inbound_transactions (id),
  item_id     uuid not null references public.items (id),
  unit_id     uuid not null references public.item_units (id),
  unit_name   text not null,
  input_qty   integer not null check (input_qty > 0),
  factor      integer not null check (factor > 0),
  base_qty    bigint generated always as (input_qty::bigint * factor) stored,
  unique (inbound_id, item_id)
);

-- Validasi baris item [{item_id, unit_id, qty}] → tabel sementara terurut.
-- Dipakai inbound (dan nanti shipment/distribusi).
create function app.parse_item_lines(p_items jsonb, p_item_type public.item_type)
returns table (item_id uuid, unit_id uuid, unit_name text, input_qty integer, factor integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_line jsonb;
  v_count int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'VALIDATION: minimal satu barang';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'VALIDATION: maksimal 100 baris barang';
  end if;

  for v_line in select * from jsonb_array_elements(p_items) loop
    if (v_line ->> 'qty') is null or (v_line ->> 'qty') !~ '^[0-9]+$' or (v_line ->> 'qty')::bigint <= 0
       or (v_line ->> 'qty')::bigint > 100000000 then
      raise exception 'VALIDATION: jumlah harus bilangan bulat lebih dari 0';
    end if;
  end loop;

  select count(*) into v_count from (
    select distinct (l ->> 'item_id') from jsonb_array_elements(p_items) l
  ) d;
  if v_count <> jsonb_array_length(p_items) then
    raise exception 'VALIDATION: barang yang sama tidak boleh muncul dua kali';
  end if;

  return query
  select i.id, u.id, u.unit_name, (l ->> 'qty')::integer, u.factor
    from jsonb_array_elements(p_items) l
    left join public.items i on i.id = (l ->> 'item_id')::uuid and i.is_active and i.type = p_item_type
    left join public.item_units u on u.id = (l ->> 'unit_id')::uuid and u.item_id = i.id and u.is_active
   order by i.id;

  if exists (
    select 1 from jsonb_array_elements(p_items) l
     where not exists (
       select 1 from public.items i
         join public.item_units u on u.item_id = i.id
        where i.id = (l ->> 'item_id')::uuid and i.is_active and i.type = p_item_type
          and u.id = (l ->> 'unit_id')::uuid and u.is_active
     )
  ) then
    raise exception 'VALIDATION: barang atau satuan tidak valid / nonaktif / tipe tidak sesuai';
  end if;
end;
$$;

create function public.create_inbound(
  p_idempotency_key uuid,
  p_vendor_id uuid,
  p_transaction_date date,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_existing public.inbound_transactions;
  v_hub uuid;
  v_id uuid;
  v_doc text;
  v_line record;
begin
  if not app.has_role('SUPER_OWNER', 'ADMIN_GUDANG') then
    raise exception 'FORBIDDEN';
  end if;
  if p_idempotency_key is null then
    raise exception 'VALIDATION: idempotency key wajib';
  end if;

  -- Retry aman: kembalikan transaksi pertama.
  select * into v_existing from public.inbound_transactions where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.created_by <> v_uid then
      raise exception 'VALIDATION: idempotency key sudah dipakai';
    end if;
    return jsonb_build_object('id', v_existing.id, 'doc_no', v_existing.doc_no, 'replayed', true);
  end if;

  select id into v_hub from public.locations where is_inbound_hub and is_active and deleted_at is null;
  if v_hub is null then
    raise exception 'VALIDATION: lokasi tujuan inbound (gudang pusat) belum diatur';
  end if;
  perform app.assert_location_access(v_hub);
  perform app.assert_transaction_date(p_transaction_date);

  if not exists (select 1 from public.vendors where id = p_vendor_id and is_active) then
    raise exception 'VALIDATION: vendor tidak valid atau nonaktif';
  end if;

  v_doc := app.next_doc_no('INB');
  insert into public.inbound_transactions (doc_no, vendor_id, location_id, transaction_date, notes, idempotency_key, created_by)
  values (v_doc, p_vendor_id, v_hub, p_transaction_date, nullif(trim(p_notes), ''), p_idempotency_key, v_uid)
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    -- Request paralel dengan key yang sama menang lebih dulu.
    select * into v_existing from public.inbound_transactions where idempotency_key = p_idempotency_key;
    return jsonb_build_object('id', v_existing.id, 'doc_no', v_existing.doc_no, 'replayed', true);
  end if;

  for v_line in select * from app.parse_item_lines(p_items, 'PACKAGING') loop
    insert into public.inbound_items (inbound_id, item_id, unit_id, unit_name, input_qty, factor)
    values (v_id, v_line.item_id, v_line.unit_id, v_line.unit_name, v_line.input_qty, v_line.factor);
    perform app.apply_stock_delta(
      v_line.item_id, v_hub, v_line.input_qty::bigint * v_line.factor, 'INBOUND',
      'inbound', v_id, v_doc, null, v_hub
    );
  end loop;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'INBOUND_CREATED', 'inbound_transactions', v_id::text,
          jsonb_build_object('doc_no', v_doc, 'vendor_id', p_vendor_id, 'items', p_items));

  return jsonb_build_object('id', v_id, 'doc_no', v_doc, 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- STOK AWAL (Q1) & PENYESUAIAN / STOCK OPNAME (Q3) — SUPER_OWNER
-- Input = jumlah fisik dalam satuan dasar; sistem menghitung selisih.
-- ---------------------------------------------------------------------
create table public.stock_adjustments (
  id               uuid primary key default gen_random_uuid(),
  doc_no           text not null unique,
  kind             text not null check (kind in ('OPENING_BALANCE', 'ADJUSTMENT')),
  location_id      uuid not null references public.locations (id),
  reason           text not null check (length(trim(reason)) > 0),
  adjustment_date  date not null,
  idempotency_key  uuid not null unique,
  created_by       uuid not null references public.profiles (id),
  created_at       timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references public.profiles (id),
  void_reason      text,
  check (voided_at is null or (voided_by is not null and length(trim(void_reason)) > 0))
);
create index stock_adjustments_loc_idx on public.stock_adjustments (location_id, adjustment_date desc);

create table public.stock_adjustment_items (
  id             uuid primary key default gen_random_uuid(),
  adjustment_id  uuid not null references public.stock_adjustments (id),
  item_id        uuid not null references public.items (id),
  system_qty     bigint not null check (system_qty >= 0),
  physical_qty   bigint not null check (physical_qty >= 0),
  delta          bigint generated always as (physical_qty - system_qty) stored,
  unique (adjustment_id, item_id)
);

create function public.create_stock_adjustment(
  p_idempotency_key uuid,
  p_kind text,
  p_location_id uuid,
  p_reason text,
  p_adjustment_date date,
  p_items jsonb -- [{item_id, physical_qty}]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_existing public.stock_adjustments;
  v_id uuid;
  v_doc text;
  v_line record;
  v_system bigint;
  v_count int;
begin
  if not app.is_super_owner() then
    raise exception 'FORBIDDEN';
  end if;
  if p_kind not in ('OPENING_BALANCE', 'ADJUSTMENT') then
    raise exception 'VALIDATION: jenis penyesuaian tidak valid';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'VALIDATION: alasan wajib diisi';
  end if;

  select * into v_existing from public.stock_adjustments where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'doc_no', v_existing.doc_no, 'replayed', true);
  end if;

  if not exists (select 1 from public.locations where id = p_location_id and is_active and deleted_at is null) then
    raise exception 'VALIDATION: lokasi tidak valid';
  end if;
  perform app.assert_transaction_date(p_adjustment_date);

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'VALIDATION: minimal satu barang';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) l
     where (l ->> 'physical_qty') is null or (l ->> 'physical_qty') !~ '^[0-9]+$'
        or not exists (select 1 from public.items i where i.id = (l ->> 'item_id')::uuid)
  ) then
    raise exception 'VALIDATION: jumlah fisik harus bilangan bulat ≥ 0 dan barang harus valid';
  end if;
  select count(distinct l ->> 'item_id') into v_count from jsonb_array_elements(p_items) l;
  if v_count <> jsonb_array_length(p_items) then
    raise exception 'VALIDATION: barang yang sama tidak boleh muncul dua kali';
  end if;

  v_doc := app.next_doc_no(case p_kind when 'OPENING_BALANCE' then 'OPN' else 'ADJ' end);
  insert into public.stock_adjustments (doc_no, kind, location_id, reason, adjustment_date, idempotency_key, created_by)
  values (v_doc, p_kind, p_location_id, trim(p_reason), p_adjustment_date, p_idempotency_key, v_uid)
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select * into v_existing from public.stock_adjustments where idempotency_key = p_idempotency_key;
    return jsonb_build_object('id', v_existing.id, 'doc_no', v_existing.doc_no, 'replayed', true);
  end if;

  for v_line in
    select (l ->> 'item_id')::uuid as item_id, (l ->> 'physical_qty')::bigint as physical_qty
      from jsonb_array_elements(p_items) l
     order by 1
  loop
    -- Kunci saldo saat ini.
    insert into public.stocks (item_id, location_id) values (v_line.item_id, p_location_id) on conflict do nothing;
    select quantity into v_system from public.stocks
     where item_id = v_line.item_id and location_id = p_location_id for update;

    if p_kind = 'OPENING_BALANCE' then
      -- Stok awal hanya sekali per barang per lokasi: tidak boleh ada pergerakan aktif sebelumnya.
      if exists (
        select 1 from public.stock_movements m
         where m.item_id = v_line.item_id and m.location_id = p_location_id
           and not exists (
             select 1 from public.stock_adjustments a
              where m.ref_type = 'stock_adjustment' and a.id = m.ref_id and a.voided_at is not null
           )
      ) then
        raise exception 'VALIDATION: stok awal % di lokasi ini sudah pernah diinput atau sudah ada transaksi. Gunakan Penyesuaian.',
          (select name from public.items where id = v_line.item_id);
      end if;
    end if;

    insert into public.stock_adjustment_items (adjustment_id, item_id, system_qty, physical_qty)
    values (v_id, v_line.item_id, v_system, v_line.physical_qty);

    if v_line.physical_qty <> v_system then
      perform app.apply_stock_delta(
        v_line.item_id, p_location_id, v_line.physical_qty - v_system,
        case
          when p_kind = 'OPENING_BALANCE' then 'OPENING_BALANCE'::public.movement_type
          when v_line.physical_qty > v_system then 'ADJUSTMENT_IN'::public.movement_type
          else 'ADJUSTMENT_OUT'::public.movement_type
        end,
        'stock_adjustment', v_id, v_doc
      );
    end if;
  end loop;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'STOCK_ADJUSTMENT_CREATED', 'stock_adjustments', v_id::text,
          jsonb_build_object('doc_no', v_doc, 'kind', p_kind, 'location_id', p_location_id, 'reason', p_reason, 'items', p_items));

  return jsonb_build_object('id', v_id, 'doc_no', v_doc, 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- VOID (Q2) — SUPER_OWNER. Membalik semua movement transaksi.
-- Ditolak jika stok hasil transaksi sudah terpakai (INSUFFICIENT_STOCK).
-- Phase ini: inbound & stock_adjustment. Produksi/distribusi menyusul.
-- ---------------------------------------------------------------------
create function public.void_transaction(p_ref_type text, p_ref_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_doc text;
  v_voided timestamptz;
  v_mv record;
begin
  if not app.is_super_owner() then
    raise exception 'FORBIDDEN';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'VALIDATION: alasan void wajib diisi';
  end if;

  if p_ref_type = 'inbound' then
    select doc_no, voided_at into v_doc, v_voided from public.inbound_transactions where id = p_ref_id for update;
  elsif p_ref_type = 'stock_adjustment' then
    select doc_no, voided_at into v_doc, v_voided from public.stock_adjustments where id = p_ref_id for update;
  else
    raise exception 'VALIDATION: jenis transaksi tidak bisa di-void';
  end if;

  if v_doc is null then
    raise exception 'NOT_FOUND: transaksi tidak ditemukan';
  end if;
  if v_voided is not null then
    return jsonb_build_object('doc_no', v_doc, 'replayed', true);
  end if;

  for v_mv in
    select item_id, location_id, quantity_delta, from_location_id, to_location_id
      from public.stock_movements
     where ref_type = p_ref_type and ref_id = p_ref_id and movement_type <> 'VOID_REVERSAL'
     order by item_id, location_id
  loop
    perform app.apply_stock_delta(
      v_mv.item_id, v_mv.location_id, -v_mv.quantity_delta, 'VOID_REVERSAL',
      p_ref_type, p_ref_id, v_doc, v_mv.to_location_id, v_mv.from_location_id
    );
  end loop;

  if p_ref_type = 'inbound' then
    update public.inbound_transactions set voided_at = now(), voided_by = v_uid, void_reason = trim(p_reason) where id = p_ref_id;
  else
    update public.stock_adjustments set voided_at = now(), voided_by = v_uid, void_reason = trim(p_reason) where id = p_ref_id;
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'TRANSACTION_VOIDED', p_ref_type, p_ref_id::text, jsonb_build_object('doc_no', v_doc, 'reason', p_reason));

  return jsonb_build_object('doc_no', v_doc, 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- VIEW stok (security_invoker → RLS tabel dasar berlaku)
-- ---------------------------------------------------------------------
create view public.stock_levels with (security_invoker = true) as
select
  s.item_id,
  s.location_id,
  s.quantity,
  s.updated_at,
  i.sku,
  i.name as item_name,
  i.type as item_type,
  i.base_unit,
  i.min_stock,
  l.code as location_code,
  l.name as location_name,
  l.type as location_type,
  (s.quantity < i.min_stock) as is_low
from public.stocks s
join public.items i on i.id = s.item_id
join public.locations l on l.id = s.location_id;

-- ---------------------------------------------------------------------
-- GRANTS & RLS — client hanya SELECT; semua tulis lewat RPC.
-- ---------------------------------------------------------------------
revoke all on public.stocks, public.stock_movements, public.doc_counters, public.inbound_transactions,
  public.inbound_items, public.stock_adjustments, public.stock_adjustment_items, public.stock_levels
  from anon, authenticated;
grant select on public.stocks, public.stock_movements, public.inbound_transactions, public.inbound_items,
  public.stock_adjustments, public.stock_adjustment_items, public.stock_levels to authenticated;

alter table public.stocks enable row level security;
alter table public.stock_movements enable row level security;
alter table public.doc_counters enable row level security;
alter table public.inbound_transactions enable row level security;
alter table public.inbound_items enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustment_items enable row level security;

create policy stocks_select on public.stocks for select to authenticated
  using ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK')) and app.has_location(location_id));

create policy stock_movements_select on public.stock_movements for select to authenticated
  using ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK')) and app.has_location(location_id));

create policy inbound_select on public.inbound_transactions for select to authenticated
  using ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG')) and app.has_location(location_id));

create policy inbound_items_select on public.inbound_items for select to authenticated
  using (exists (select 1 from public.inbound_transactions t where t.id = inbound_id));

create policy stock_adjustments_select on public.stock_adjustments for select to authenticated
  using ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK')) and app.has_location(location_id));

create policy stock_adjustment_items_select on public.stock_adjustment_items for select to authenticated
  using (exists (select 1 from public.stock_adjustments a where a.id = adjustment_id));

-- ---------------------------------------------------------------------
-- EXECUTE: helper internal tertutup; hanya RPC publik untuk authenticated.
-- ---------------------------------------------------------------------
revoke all on function app.next_doc_no(text), app.today_wib(), app.assert_transaction_date(date),
  app.require_active_user(), app.assert_location_access(uuid),
  app.apply_stock_delta(uuid, uuid, bigint, public.movement_type, text, uuid, text, uuid, uuid),
  app.parse_item_lines(jsonb, public.item_type)
  from public, anon, authenticated;

revoke all on function public.create_inbound(uuid, uuid, date, text, jsonb),
  public.create_stock_adjustment(uuid, text, uuid, text, date, jsonb),
  public.void_transaction(text, uuid, text)
  from public, anon;
grant execute on function public.create_inbound(uuid, uuid, date, text, jsonb),
  public.create_stock_adjustment(uuid, text, uuid, text, date, jsonb),
  public.void_transaction(text, uuid, text)
  to authenticated;
