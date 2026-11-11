-- =====================================================================
-- SASANA WAREHOUSE — PostgreSQL SCHEMA DRAFT (PHASE 0)
-- STATUS: DRAFT untuk review. BUKAN migration. Jangan dijalankan ke DB.
-- Akan dipecah menjadi migration terstruktur di Phase 1–6 setelah
-- pertanyaan keputusan (lihat PHASE-0-DISCOVERY.md §14) dijawab.
-- Semua quantity disimpan dalam BASE UNIT, tipe integer (bigint).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type public.user_role       as enum ('SUPER_OWNER','ADMIN_GUDANG','OWNER_PABRIK','DRIVER');
-- Q4: 'SALES_WAREHOUSE' (Gudang Penjualan). Tipe untuk "lokasi tertentu" menunggu Q4a (lihat §15 dokumen).
create type public.location_type   as enum ('WAREHOUSE','FACTORY','SALES_WAREHOUSE');
create type public.item_type       as enum ('PACKAGING','FINISHED_GOOD');
create type public.shipment_status as enum ('CREATED','ASSIGNED','PICKED_UP','RECEIVED','CANCELLED');
create type public.movement_type   as enum (
  'INBOUND',
  'SHIPMENT_PICKUP',
  'SHIPMENT_RECEIVE',
  'PRODUCTION_CONSUME',
  'PRODUCTION_RESULT',
  'DISTRIBUTION',
  'OPENING_BALANCE',   -- Q1: stok awal hasil cek fisik saat go-live
  'ADJUSTMENT_IN',     -- Q3: selisih fisik / koreksi (stock opname)
  'ADJUSTMENT_OUT',
  'VOID_REVERSAL',     -- Q2: pembalik saat transaksi di-void
  'SHIPMENT_RETURN'    -- Q3: shipment PICKED_UP dibatalkan, stok kembali ke asal
);

-- ---------------------------------------------------------------------
-- MASTER: LOCATIONS
-- ---------------------------------------------------------------------
create table public.locations (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[A-Z0-9-]{2,20}$'),
  name            text not null check (length(trim(name)) > 0),
  address         text,
  type            public.location_type not null,
  is_inbound_hub  boolean not null default false,   -- tujuan default inbound (Gudang Rumah). Bukan hardcode nama.
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
-- Hanya boleh ada satu inbound hub aktif.
create unique index locations_one_inbound_hub
  on public.locations (is_inbound_hub) where is_inbound_hub and deleted_at is null;

-- ---------------------------------------------------------------------
-- MASTER: PROFILES & LOCATION ASSIGNMENT
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete restrict,
  username    text not null unique check (username ~ '^[a-z0-9._]{3,30}$'),  -- Q13: login pakai username
  full_name   text not null check (length(trim(full_name)) > 0),
  email       text,          -- email asli opsional (kontak). Auth memakai email sintetis <username>@users.sasana.internal
  role        public.user_role not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.user_locations (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id),
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  primary key (user_id, location_id)
);
create index user_locations_location_idx on public.user_locations (location_id);

-- ---------------------------------------------------------------------
-- MASTER: ITEMS, UNITS, PACKAGING MAP, VENDORS
-- ---------------------------------------------------------------------
create table public.items (
  id          uuid primary key default gen_random_uuid(),
  sku         text not null unique,
  name        text not null check (length(trim(name)) > 0),
  type        public.item_type not null,
  base_unit   text not null,                                   -- 'sachet', 'pcs', 'botol', ...
  min_stock   bigint not null default 50 check (min_stock >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index items_type_idx on public.items (type) where deleted_at is null;

-- Nama di prompt: product_units. Dipakai untuk SEMUA item (packaging juga butuh satuan inbound).
create table public.item_units (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items(id),
  unit_name   text not null,                                   -- 'sachet', 'renteng', 'dus'
  factor      integer not null check (factor > 0),             -- 1 unit = factor × base unit
  is_base     boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (item_id, unit_name),
  check (not is_base or factor = 1)
);
create unique index item_units_one_base on public.item_units (item_id) where is_base;

-- MVP: 1 produk jadi → 1 packaging utama. Tipe item divalidasi oleh trigger.
create table public.product_packagings (
  finished_item_id   uuid primary key references public.items(id),
  packaging_item_id  uuid not null references public.items(id),
  updated_by         uuid references public.profiles(id),
  updated_at         timestamptz not null default now(),
  check (finished_item_id <> packaging_item_id)
);

create table public.vendors (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null check (length(trim(name)) > 0),
  phone       text,
  address     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ---------------------------------------------------------------------
-- STOCK (saldo) & STOCK MOVEMENTS (ledger)
-- Invariant: stocks.quantity = SUM(stock_movements.quantity_delta) per (item, location)
-- ---------------------------------------------------------------------
create table public.stocks (
  item_id     uuid not null references public.items(id),
  location_id uuid not null references public.locations(id),
  quantity    bigint not null default 0 check (quantity >= 0),  -- garansi no negative stock di level DB
  updated_at  timestamptz not null default now(),
  primary key (item_id, location_id)
);
create index stocks_location_idx on public.stocks (location_id);

create table public.stock_movements (
  id                bigint generated always as identity primary key,
  item_id           uuid not null references public.items(id),
  location_id       uuid not null references public.locations(id),   -- lokasi yang saldonya berubah
  quantity_delta    bigint not null check (quantity_delta <> 0),      -- + masuk / - keluar
  balance_after     bigint not null check (balance_after >= 0),
  movement_type     public.movement_type not null,
  from_location_id  uuid references public.locations(id),
  to_location_id    uuid references public.locations(id),
  ref_type          text not null,                                    -- 'inbound' | 'shipment' | 'production' | 'distribution'
  ref_id            uuid not null,
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  -- Cegah duplicate movement untuk transaksi yang sama:
  unique (ref_type, ref_id, movement_type, item_id)
);
create index stock_movements_item_loc_time_idx on public.stock_movements (item_id, location_id, created_at desc);
create index stock_movements_ref_idx           on public.stock_movements (ref_type, ref_id);
create index stock_movements_time_idx          on public.stock_movements (created_at desc);

-- ---------------------------------------------------------------------
-- INBOUND
-- ---------------------------------------------------------------------
create table public.inbound_transactions (
  id                uuid primary key default gen_random_uuid(),
  doc_no            text not null unique,                    -- INB-202611-0001
  vendor_id         uuid not null references public.vendors(id),
  location_id       uuid not null references public.locations(id),  -- selalu inbound hub (MVP), divalidasi RPC
  transaction_date  date not null,
  notes             text,
  idempotency_key   uuid not null unique,
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now()
);

create table public.inbound_items (
  id           uuid primary key default gen_random_uuid(),
  inbound_id   uuid not null references public.inbound_transactions(id),
  item_id      uuid not null references public.items(id),
  unit_id      uuid not null references public.item_units(id),
  unit_name    text not null,                                -- snapshot
  input_qty    integer not null check (input_qty > 0),
  factor       integer not null check (factor > 0),          -- snapshot konversi saat transaksi
  base_qty     bigint generated always as (input_qty::bigint * factor) stored,
  unique (inbound_id, item_id)
);

-- ---------------------------------------------------------------------
-- SHIPMENT
-- ---------------------------------------------------------------------
create table public.shipments (
  id                uuid primary key default gen_random_uuid(),
  doc_no            text not null unique,                    -- SHP-202611-0001
  from_location_id  uuid not null references public.locations(id),
  to_location_id    uuid not null references public.locations(id),
  status            public.shipment_status not null default 'CREATED',
  driver_id         uuid references public.profiles(id),
  notes             text,
  idempotency_key   uuid not null unique,
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  assigned_by       uuid references public.profiles(id),
  assigned_at       timestamptz,
  picked_up_by      uuid references public.profiles(id),
  picked_up_at      timestamptz,
  received_by       uuid references public.profiles(id),
  received_at       timestamptz,
  cancelled_by      uuid references public.profiles(id),
  cancelled_at      timestamptz,
  cancel_reason     text,
  updated_at        timestamptz not null default now(),
  check (from_location_id <> to_location_id),
  -- Konsistensi status ↔ jejak waktu:
  check (status not in ('ASSIGNED','PICKED_UP','RECEIVED') or driver_id is not null),
  check (status not in ('PICKED_UP','RECEIVED') or (picked_up_at is not null and picked_up_by is not null)),
  check (status <> 'RECEIVED'  or (received_at is not null and received_by is not null)),
  check (status <> 'CANCELLED' or (cancelled_at is not null and cancel_reason is not null))
);
create index shipments_status_idx on public.shipments (status, created_at desc);
create index shipments_driver_idx on public.shipments (driver_id, status);
create index shipments_from_idx   on public.shipments (from_location_id);
create index shipments_to_idx     on public.shipments (to_location_id);

create table public.shipment_items (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid not null references public.shipments(id),
  item_id      uuid not null references public.items(id),
  unit_id      uuid not null references public.item_units(id),
  unit_name    text not null,
  input_qty    integer not null check (input_qty > 0),
  factor       integer not null check (factor > 0),
  base_qty     bigint generated always as (input_qty::bigint * factor) stored,
  unique (shipment_id, item_id)
);

-- ---------------------------------------------------------------------
-- PRODUCTION
-- ---------------------------------------------------------------------
create table public.productions (
  id                  uuid primary key default gen_random_uuid(),
  doc_no              text not null unique,                  -- PRD-202611-0001
  location_id         uuid not null references public.locations(id),
  finished_item_id    uuid not null references public.items(id),
  packaging_item_id   uuid not null references public.items(id),   -- snapshot mapping saat produksi
  qty_good            bigint not null check (qty_good >= 0),
  qty_reject          bigint not null check (qty_reject >= 0),
  packaging_consumed  bigint generated always as (qty_good + qty_reject) stored,
  production_date     date not null,
  notes               text,
  idempotency_key     uuid not null unique,
  created_by          uuid not null references public.profiles(id),
  created_at          timestamptz not null default now(),
  check (qty_good + qty_reject > 0)
);
create index productions_loc_date_idx on public.productions (location_id, production_date desc);

-- ---------------------------------------------------------------------
-- DISTRIBUTION
-- ---------------------------------------------------------------------
create table public.distributions (
  id                uuid primary key default gen_random_uuid(),
  doc_no            text not null unique,                    -- DST-202611-0001
  location_id       uuid not null references public.locations(id),
  item_id           uuid not null references public.items(id),
  unit_id           uuid not null references public.item_units(id),
  unit_name         text not null,
  input_qty         integer not null check (input_qty > 0),
  factor            integer not null check (factor > 0),
  base_qty          bigint generated always as (input_qty::bigint * factor) stored,
  buyer_name        text not null check (length(trim(buyer_name)) > 0),
  transaction_date  date not null,
  notes             text,
  idempotency_key   uuid not null unique,
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now()
);
create index distributions_loc_date_idx on public.distributions (location_id, transaction_date desc);

-- ---------------------------------------------------------------------
-- VOID (Q2) — kolom yang ditambahkan ke inbound_transactions, productions,
-- distributions, stock_adjustments:
--   voided_at timestamptz, voided_by uuid references profiles(id), void_reason text,
--   check (voided_at is null or (voided_by is not null and length(trim(void_reason)) > 0))
-- Void = movement VOID_REVERSAL untuk setiap movement asli; ditolak jika stok hasil
-- transaksi sudah terpakai (CHECK >= 0 akan gagal). Hanya SUPER_OWNER.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- STOK AWAL & PENYESUAIAN (Q1, Q3)
-- ---------------------------------------------------------------------
create table public.stock_adjustments (
  id                uuid primary key default gen_random_uuid(),
  doc_no            text not null unique,                    -- ADJ-202611-0001 / OPN-202611-0001
  kind              text not null check (kind in ('OPENING_BALANCE','ADJUSTMENT')),
  location_id       uuid not null references public.locations(id),
  reason            text not null check (length(trim(reason)) > 0),
  adjustment_date   date not null,
  idempotency_key   uuid not null unique,
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  voided_at         timestamptz,
  voided_by         uuid references public.profiles(id),
  void_reason       text
);

create table public.stock_adjustment_items (
  id             uuid primary key default gen_random_uuid(),
  adjustment_id  uuid not null references public.stock_adjustments(id),
  item_id        uuid not null references public.items(id),
  system_qty     bigint not null check (system_qty >= 0),    -- saldo sistem saat input (snapshot)
  physical_qty   bigint not null check (physical_qty >= 0),  -- hasil hitung fisik
  delta          bigint generated always as (physical_qty - system_qty) stored,
  unique (adjustment_id, item_id)
);
-- OPENING_BALANCE hanya diterima jika item+lokasi belum punya movement apa pun.

-- ---------------------------------------------------------------------
-- AUDIT LOG (append-only)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id),
  action      text not null,          -- 'INBOUND_CREATED', 'SHIPMENT_PICKED_UP', 'ITEM_UPDATED', ...
  table_name  text not null,
  record_id   text not null,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_time_idx   on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------
-- DOCUMENT NUMBER
-- ---------------------------------------------------------------------
create table public.doc_counters (
  prefix  text not null,         -- 'INB' | 'SHP' | 'PRD' | 'DST'
  period  text not null,         -- 'YYYYMM' (Asia/Jakarta)
  last_no integer not null default 0,
  primary key (prefix, period)
);
-- next_doc_no(prefix): UPDATE ... SET last_no = last_no + 1 RETURNING  (row lock, tanpa gap kecuali rollback)

-- =====================================================================
-- RPC SIGNATURES (implementasi di Phase 3–6)
-- Semua: SECURITY DEFINER, SET search_path = '', cek auth.uid() aktif,
-- cek role + lokasi, satu transaksi, raise error ber-kode.
-- =====================================================================
-- internal (REVOKE dari anon/authenticated):
--   _apply_stock_delta(item_id, location_id, delta, movement_type, from_loc, to_loc, ref_type, ref_id) returns bigint
--   _assert_role(variadic roles user_role[])
--   _assert_location_access(location_id)
--   _next_doc_no(prefix) returns text
--   _audit(action, table_name, record_id, old jsonb, new jsonb)
--
-- publik (GRANT EXECUTE ke authenticated):
--   rpc_create_inbound(p_idempotency_key uuid, p_vendor_id uuid, p_transaction_date date, p_notes text, p_items jsonb)  returns jsonb
--   rpc_create_shipment(p_idempotency_key uuid, p_from uuid, p_to uuid, p_notes text, p_items jsonb)                     returns jsonb
--   rpc_assign_driver(p_shipment_id uuid, p_driver_id uuid)                                                                returns jsonb
--   rpc_pickup_shipment(p_shipment_id uuid)                                                                                returns jsonb
--   rpc_receive_shipment(p_shipment_id uuid)                                                                               returns jsonb
--   rpc_cancel_shipment(p_shipment_id uuid, p_reason text)                                                                 returns jsonb
--   rpc_create_production(p_idempotency_key uuid, p_location_id uuid, p_finished_item_id uuid, p_qty_good bigint,
--                         p_qty_reject bigint, p_production_date date, p_notes text)                                       returns jsonb
--   rpc_create_distribution(p_idempotency_key uuid, p_location_id uuid, p_item_id uuid, p_unit_id uuid, p_qty int,
--                           p_buyer_name text, p_transaction_date date, p_notes text)                                      returns jsonb
--   rpc_create_stock_adjustment(p_idempotency_key uuid, p_kind text, p_location_id uuid, p_reason text,
--                               p_adjustment_date date, p_items jsonb /* [{item_id, physical_qty}] */)       returns jsonb
--   rpc_void_transaction(p_ref_type text, p_ref_id uuid, p_reason text)                                        returns jsonb
--   rpc_cancel_shipment juga menerima status PICKED_UP (SUPER_OWNER saja) → SHIPMENT_RETURN ke lokasi asal
--   rpc_dashboard_summary(p_location_id uuid default null, p_from date default null, p_to date default null)              returns jsonb
