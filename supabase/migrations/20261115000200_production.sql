-- =====================================================================
-- PHASE 5 — PRODUKSI
-- Keputusan:
--   Q7  : 1 produk jadi = 1 unit packaging utama. Konsumsi = good + reject.
--   Q8  : produk hanya boleh diproduksi di pabrik yang terdaftar (product_locations).
--   Q10 : input produksi oleh OWNER_PABRIK dan ADMIN_PABRIK di pabriknya.
--         SUPER_OWNER tidak input, hanya melihat & void.
--   Void: SUPER_OWNER (semua) atau OWNER_PABRIK (pabriknya sendiri).
--
-- Efek stok (satu transaksi, atomik):
--   packaging : −(good + reject)  PRODUCTION_CONSUME
--   produk    : +good             PRODUCTION_RESULT (jika good > 0)
-- Good bisa diinput dalam satuan produk (sachet/renteng/dus); reject selalu
-- dalam satuan dasar packaging (sachet).
-- =====================================================================

create table public.productions (
  id                  uuid primary key default gen_random_uuid(),
  doc_no              text not null unique,
  location_id         uuid not null references public.locations (id),
  finished_item_id    uuid not null references public.items (id),
  packaging_item_id   uuid not null references public.items (id), -- snapshot mapping saat produksi
  unit_id             uuid not null references public.item_units (id),
  unit_name           text not null,
  input_qty_good      integer not null check (input_qty_good >= 0),
  factor              integer not null check (factor > 0),
  qty_good            bigint generated always as (input_qty_good::bigint * factor) stored,
  qty_reject          bigint not null check (qty_reject >= 0),
  packaging_consumed  bigint generated always as (input_qty_good::bigint * factor + qty_reject) stored,
  production_date     date not null,
  notes               text,
  idempotency_key     uuid not null unique,
  created_by          uuid not null references public.profiles (id),
  created_at          timestamptz not null default now(),
  voided_at           timestamptz,
  voided_by           uuid references public.profiles (id),
  void_reason         text,
  check (input_qty_good::bigint * factor + qty_reject > 0),
  check (finished_item_id <> packaging_item_id),
  check (voided_at is null or (voided_by is not null and length(trim(void_reason)) > 0))
);
create index productions_loc_date_idx on public.productions (location_id, production_date desc, created_at desc);
create index productions_item_idx on public.productions (finished_item_id, production_date desc);

-- ---------------------------------------------------------------------
-- CREATE
-- ---------------------------------------------------------------------
create function public.create_production(
  p_idempotency_key uuid,
  p_location_id uuid,
  p_finished_item_id uuid,
  p_unit_id uuid,
  p_qty_good bigint,
  p_qty_reject bigint,
  p_production_date date,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_existing public.productions;
  v_fg public.items;
  v_pkg public.items;
  v_unit public.item_units;
  v_good bigint;
  v_id uuid;
  v_doc text;
  v_mv record;
begin
  if not app.has_role('OWNER_PABRIK', 'ADMIN_PABRIK') then
    raise exception 'FORBIDDEN: produksi hanya diinput oleh Owner Pabrik atau Admin Pabrik';
  end if;
  if p_idempotency_key is null then
    raise exception 'VALIDATION: idempotency key wajib';
  end if;

  -- Retry aman: kembalikan transaksi pertama.
  select * into v_existing from public.productions where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.created_by <> v_uid then
      raise exception 'VALIDATION: idempotency key sudah dipakai';
    end if;
    return jsonb_build_object('id', v_existing.id, 'doc_no', v_existing.doc_no, 'replayed', true);
  end if;

  if not exists (
    select 1 from public.locations
     where id = p_location_id and type = 'FACTORY' and is_active and deleted_at is null
  ) then
    raise exception 'VALIDATION: lokasi produksi harus pabrik yang aktif';
  end if;
  perform app.assert_location_access(p_location_id);
  perform app.assert_transaction_date(p_production_date);

  if p_qty_good is null or p_qty_reject is null or p_qty_good < 0 or p_qty_reject < 0
     or p_qty_good > 100000000 or p_qty_reject > 100000000 then
    raise exception 'VALIDATION: jumlah good dan reject harus bilangan bulat ≥ 0';
  end if;

  select * into v_fg from public.items where id = p_finished_item_id and type = 'FINISHED_GOOD' and is_active;
  if not found then
    raise exception 'VALIDATION: produk tidak valid atau nonaktif';
  end if;
  if not exists (
    select 1 from public.product_locations where finished_item_id = v_fg.id and location_id = p_location_id
  ) then
    raise exception 'VALIDATION: % tidak terdaftar untuk diproduksi di pabrik ini', v_fg.name;
  end if;

  select i.* into v_pkg
    from public.product_packagings pp
    join public.items i on i.id = pp.packaging_item_id
   where pp.finished_item_id = v_fg.id;
  if not found then
    raise exception 'VALIDATION: packaging untuk % belum diatur', v_fg.name;
  end if;
  if not v_pkg.is_active then
    raise exception 'VALIDATION: packaging % nonaktif', v_pkg.name;
  end if;

  select * into v_unit from public.item_units where id = p_unit_id and item_id = v_fg.id and is_active;
  if not found then
    raise exception 'VALIDATION: satuan produk tidak valid atau nonaktif';
  end if;
  v_good := p_qty_good * v_unit.factor;
  if v_good + p_qty_reject = 0 then
    raise exception 'VALIDATION: isi jumlah good atau reject';
  end if;

  v_doc := app.next_doc_no('PRD');
  insert into public.productions (
    doc_no, location_id, finished_item_id, packaging_item_id, unit_id, unit_name, input_qty_good, factor,
    qty_reject, production_date, notes, idempotency_key, created_by
  ) values (
    v_doc, p_location_id, v_fg.id, v_pkg.id, v_unit.id, v_unit.unit_name, p_qty_good::integer, v_unit.factor,
    p_qty_reject, p_production_date, nullif(trim(p_notes), ''), p_idempotency_key, v_uid
  )
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select * into v_existing from public.productions where idempotency_key = p_idempotency_key;
    return jsonb_build_object('id', v_existing.id, 'doc_no', v_existing.doc_no, 'replayed', true);
  end if;

  -- Urut item_id agar konsisten dengan RPC lain (hindari deadlock).
  for v_mv in
    select * from (values
      (v_pkg.id, -(v_good + p_qty_reject), 'PRODUCTION_CONSUME'::public.movement_type),
      (v_fg.id, v_good, 'PRODUCTION_RESULT'::public.movement_type)
    ) m (item_id, delta, mtype)
     where delta <> 0
     order by item_id
  loop
    perform app.apply_stock_delta(
      v_mv.item_id, p_location_id, v_mv.delta, v_mv.mtype, 'production', v_id, v_doc
    );
  end loop;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'PRODUCTION_CREATED', 'productions', v_id::text,
          jsonb_build_object('doc_no', v_doc, 'location_id', p_location_id, 'finished_item_id', v_fg.id,
                             'packaging_item_id', v_pkg.id, 'qty_good', v_good, 'qty_reject', p_qty_reject));

  return jsonb_build_object('id', v_id, 'doc_no', v_doc, 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- VOID — diperluas untuk produksi.
--   inbound, stock_adjustment : SUPER_OWNER
--   production                : SUPER_OWNER, atau OWNER_PABRIK di pabriknya
-- Ditolak (INSUFFICIENT_STOCK) jika produk hasil produksi sudah terpakai.
-- ---------------------------------------------------------------------
create or replace function public.void_transaction(p_ref_type text, p_ref_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_doc text;
  v_voided timestamptz;
  v_loc uuid;
  v_mv record;
begin
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'VALIDATION: alasan void wajib diisi';
  end if;

  if p_ref_type = 'inbound' then
    select doc_no, voided_at, location_id into v_doc, v_voided, v_loc
      from public.inbound_transactions where id = p_ref_id for update;
  elsif p_ref_type = 'stock_adjustment' then
    select doc_no, voided_at, location_id into v_doc, v_voided, v_loc
      from public.stock_adjustments where id = p_ref_id for update;
  elsif p_ref_type = 'production' then
    select doc_no, voided_at, location_id into v_doc, v_voided, v_loc
      from public.productions where id = p_ref_id for update;
  else
    raise exception 'VALIDATION: jenis transaksi tidak bisa di-void';
  end if;

  if not (
    app.is_super_owner()
    or (p_ref_type = 'production' and app.has_role('OWNER_PABRIK') and v_loc is not null and app.has_location(v_loc))
  ) then
    raise exception 'FORBIDDEN';
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
  elsif p_ref_type = 'stock_adjustment' then
    update public.stock_adjustments set voided_at = now(), voided_by = v_uid, void_reason = trim(p_reason) where id = p_ref_id;
  else
    update public.productions set voided_at = now(), voided_by = v_uid, void_reason = trim(p_reason) where id = p_ref_id;
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'TRANSACTION_VOIDED', p_ref_type, p_ref_id::text, jsonb_build_object('doc_no', v_doc, 'reason', p_reason));

  return jsonb_build_object('doc_no', v_doc, 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- RECEIVE shipment: ADMIN_PABRIK ikut boleh menerima di pabriknya.
-- (isi sama dengan Phase 4, hanya daftar role yang bertambah)
-- ---------------------------------------------------------------------
create or replace function public.receive_shipment(p_shipment_id uuid)
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
  if not app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK') then
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
-- RLS: ADMIN_PABRIK membaca stok, movement, penyesuaian, shipment, dan
-- produksi di lokasinya. Policy lama diganti (bukan data yang dihapus).
-- ---------------------------------------------------------------------
drop policy stocks_select on public.stocks;
create policy stocks_select on public.stocks for select to authenticated
  using ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK')) and app.has_location(location_id));

drop policy stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK')) and app.has_location(location_id));

drop policy stock_adjustments_select on public.stock_adjustments;
create policy stock_adjustments_select on public.stock_adjustments for select to authenticated
  using ((select app.has_role('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK')) and app.has_location(location_id));

drop policy shipments_select on public.shipments;
create policy shipments_select on public.shipments for select to authenticated
  using (
    (select app.is_super_owner())
    or ((select app.has_role('ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK'))
        and (app.has_location(from_location_id) or app.has_location(to_location_id)))
    or ((select app.has_role('DRIVER')) and driver_id = (select app.uid()))
  );

revoke all on public.productions from anon, authenticated;
grant select on public.productions to authenticated;
alter table public.productions enable row level security;
create policy productions_select on public.productions for select to authenticated
  using ((select app.has_role('SUPER_OWNER', 'OWNER_PABRIK', 'ADMIN_PABRIK')) and app.has_location(location_id));

revoke all on function public.create_production(uuid, uuid, uuid, uuid, bigint, bigint, date, text) from public, anon;
grant execute on function public.create_production(uuid, uuid, uuid, uuid, bigint, bigint, date, text) to authenticated;
-- create or replace mempertahankan grant lama void_transaction & receive_shipment.
