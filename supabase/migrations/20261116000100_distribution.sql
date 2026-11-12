-- =====================================================================
-- PHASE 6 — DISTRIBUSI (produk jadi keluar ke buyer / pihak luar)
-- Keputusan:
--   Q4  : barang keluar ke pihak luar lewat distribusi (bukan shipment).
--   Q14 : buyer dari master buyers (nama di-snapshot di dokumen).
--   Q21 : Admin Gudang input distribusi dari Gudang Penjualan yang di-assign.
--   Q10 : Owner Pabrik input dari pabriknya. Admin Pabrik TIDAK input.
--         Super Owner TIDAK input; hanya melihat & void.
--   Void: Super Owner (semua) atau Owner Pabrik (distribusi dari pabriknya).
--   Konsumsi internal (rawatan ayam) = distribusi ke buyer khusus.
--
-- Efek stok: produk jadi di lokasi asal −qty (DISTRIBUTION). Satu dokumen =
-- satu buyer, banyak baris produk (satuan sachet/renteng/dus).
-- =====================================================================

create table public.distributions (
  id                uuid primary key default gen_random_uuid(),
  doc_no            text not null unique,
  location_id       uuid not null references public.locations (id),
  buyer_id          uuid not null references public.buyers (id),
  buyer_name        text not null check (length(trim(buyer_name)) > 0), -- snapshot
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
create index distributions_loc_date_idx on public.distributions (location_id, transaction_date desc, created_at desc);
create index distributions_buyer_idx on public.distributions (buyer_id, transaction_date desc);

create table public.distribution_items (
  id               uuid primary key default gen_random_uuid(),
  distribution_id  uuid not null references public.distributions (id),
  item_id          uuid not null references public.items (id),
  unit_id          uuid not null references public.item_units (id),
  unit_name        text not null,
  input_qty        integer not null check (input_qty > 0),
  factor           integer not null check (factor > 0),
  base_qty         bigint generated always as (input_qty::bigint * factor) stored,
  unique (distribution_id, item_id)
);
create index distribution_items_item_idx on public.distribution_items (item_id);

-- Siapa boleh input distribusi dari lokasi ini:
--   OWNER_PABRIK → pabrik yang di-assign; ADMIN_GUDANG → Gudang Penjualan yang di-assign.
create function app.can_distribute_from(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_location(p_location_id) and exists (
    select 1 from public.locations l
     where l.id = p_location_id and l.is_active and l.deleted_at is null
       and ((l.type = 'FACTORY' and app.has_role('OWNER_PABRIK'))
         or (l.type = 'SALES_WAREHOUSE' and app.has_role('ADMIN_GUDANG')))
  );
$$;

-- ---------------------------------------------------------------------
-- CREATE
-- ---------------------------------------------------------------------
create function public.create_distribution(
  p_idempotency_key uuid,
  p_location_id uuid,
  p_buyer_id uuid,
  p_transaction_date date,
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
  v_existing public.distributions;
  v_buyer text;
  v_id uuid;
  v_doc text;
  v_line record;
begin
  if not app.has_role('OWNER_PABRIK', 'ADMIN_GUDANG') then
    raise exception 'FORBIDDEN: distribusi diinput oleh Owner Pabrik atau Admin Gudang Penjualan';
  end if;
  if p_idempotency_key is null then
    raise exception 'VALIDATION: idempotency key wajib';
  end if;

  select * into v_existing from public.distributions where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.created_by <> v_uid then
      raise exception 'VALIDATION: idempotency key sudah dipakai';
    end if;
    return jsonb_build_object('id', v_existing.id, 'doc_no', v_existing.doc_no, 'replayed', true);
  end if;

  if not app.can_distribute_from(p_location_id) then
    raise exception 'FORBIDDEN_LOCATION';
  end if;
  perform app.assert_transaction_date(p_transaction_date);

  select name into v_buyer from public.buyers where id = p_buyer_id and is_active;
  if v_buyer is null then
    raise exception 'VALIDATION: buyer tidak valid atau nonaktif';
  end if;

  v_doc := app.next_doc_no('DST');
  insert into public.distributions (doc_no, location_id, buyer_id, buyer_name, transaction_date, notes, idempotency_key, created_by)
  values (v_doc, p_location_id, p_buyer_id, v_buyer, p_transaction_date, nullif(trim(p_notes), ''), p_idempotency_key, v_uid)
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select * into v_existing from public.distributions where idempotency_key = p_idempotency_key;
    return jsonb_build_object('id', v_existing.id, 'doc_no', v_existing.doc_no, 'replayed', true);
  end if;

  -- parse_item_lines: hanya produk jadi aktif, terurut item_id (anti deadlock).
  for v_line in select * from app.parse_item_lines(p_items, 'FINISHED_GOOD') loop
    insert into public.distribution_items (distribution_id, item_id, unit_id, unit_name, input_qty, factor)
    values (v_id, v_line.item_id, v_line.unit_id, v_line.unit_name, v_line.input_qty, v_line.factor);
    perform app.apply_stock_delta(
      v_line.item_id, p_location_id, -(v_line.input_qty::bigint * v_line.factor), 'DISTRIBUTION',
      'distribution', v_id, v_doc, p_location_id, null
    );
  end loop;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'DISTRIBUTION_CREATED', 'distributions', v_id::text,
          jsonb_build_object('doc_no', v_doc, 'location_id', p_location_id, 'buyer_id', p_buyer_id, 'items', p_items));

  return jsonb_build_object('id', v_id, 'doc_no', v_doc, 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- VOID — diperluas untuk distribusi.
--   inbound, stock_adjustment : SUPER_OWNER
--   production                : SUPER_OWNER, atau OWNER_PABRIK di pabriknya
--   distribution              : SUPER_OWNER, atau OWNER_PABRIK untuk distribusi dari pabriknya
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
  elsif p_ref_type = 'distribution' then
    select doc_no, voided_at, location_id into v_doc, v_voided, v_loc
      from public.distributions where id = p_ref_id for update;
  else
    raise exception 'VALIDATION: jenis transaksi tidak bisa di-void';
  end if;

  if not (
    app.is_super_owner()
    or (p_ref_type in ('production', 'distribution') and app.has_role('OWNER_PABRIK')
        and v_loc is not null and app.has_location(v_loc)
        and exists (select 1 from public.locations where id = v_loc and type = 'FACTORY'))
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
  elsif p_ref_type = 'production' then
    update public.productions set voided_at = now(), voided_by = v_uid, void_reason = trim(p_reason) where id = p_ref_id;
  else
    update public.distributions set voided_at = now(), voided_by = v_uid, void_reason = trim(p_reason) where id = p_ref_id;
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'TRANSACTION_VOIDED', p_ref_type, p_ref_id::text, jsonb_build_object('doc_no', v_doc, 'reason', p_reason));

  return jsonb_build_object('doc_no', v_doc, 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------
-- RLS: SO semua; OP & AG di lokasi yang di-assign. Admin Pabrik & driver tidak.
-- ---------------------------------------------------------------------
revoke all on public.distributions, public.distribution_items from anon, authenticated;
grant select on public.distributions, public.distribution_items to authenticated;
alter table public.distributions enable row level security;
alter table public.distribution_items enable row level security;

create policy distributions_select on public.distributions for select to authenticated
  using ((select app.has_role('SUPER_OWNER', 'OWNER_PABRIK', 'ADMIN_GUDANG')) and app.has_location(location_id));
create policy distribution_items_select on public.distribution_items for select to authenticated
  using (exists (select 1 from public.distributions d where d.id = distribution_id));

revoke all on function app.can_distribute_from(uuid) from public, anon, authenticated;
revoke all on function public.create_distribution(uuid, uuid, uuid, date, text, jsonb) from public, anon;
grant execute on function public.create_distribution(uuid, uuid, uuid, date, text, jsonb) to authenticated;

-- Buyer khusus untuk pemakaian internal (keputusan: rawatan ayam = distribusi).
insert into public.buyers (name, notes)
values ('Konsumsi internal – Rawatan ayam', 'Pemakaian produk sendiri untuk rawatan ayam (mis. di Pabrik Kemranjen).')
on conflict do nothing;
