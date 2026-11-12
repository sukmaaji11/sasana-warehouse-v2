-- =====================================================================
-- PHASE 7 — DASHBOARD & LAPORAN (hanya baca)
-- Semua fungsi SECURITY INVOKER: RLS tabel dasar tetap berlaku, jadi user
-- hanya melihat lokasi yang di-assign (SO: semua). Tidak ada perubahan data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- MUTASI STOK (kartu stok) per lokasi × barang untuk periode [from, to] (WIB).
-- Dasar: waktu pencatatan movement (created_at), bukan tanggal dokumen —
-- sehingga saldo awal + mutasi = saldo akhir selalu cocok dengan ledger.
-- ---------------------------------------------------------------------
create function public.report_stock_mutation(p_from date, p_to date, p_location_id uuid default null)
returns table (
  location_id    uuid,
  location_name  text,
  item_id        uuid,
  sku            text,
  item_name      text,
  item_type      public.item_type,
  base_unit      text,
  opening        bigint,
  inbound        bigint,  -- INBOUND
  received       bigint,  -- SHIPMENT_RECEIVE + SHIPMENT_RETURN
  produced       bigint,  -- PRODUCTION_RESULT
  consumed       bigint,  -- PRODUCTION_CONSUME (positif)
  shipped        bigint,  -- SHIPMENT_PICKUP (positif)
  distributed    bigint,  -- DISTRIBUTION (positif)
  adjusted       bigint,  -- stok awal & penyesuaian/opname (bersih, bisa negatif)
  closing        bigint
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_start timestamptz := (p_from::timestamp at time zone 'Asia/Jakarta');
  v_end   timestamptz := ((p_to + 1)::timestamp at time zone 'Asia/Jakarta');
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'VALIDATION: periode tidak valid';
  end if;
  if p_to - p_from > 366 then
    raise exception 'VALIDATION: periode maksimal 1 tahun';
  end if;

  return query
  with m as (
    -- Pembalikan void dihitung pada kolom jenis transaksi aslinya (mis. void produksi
    -- mengurangi kolom "hasil produksi"), sehingga angka sama dengan laporan per dokumen.
    select sm.location_id, sm.item_id, sm.quantity_delta, sm.created_at >= v_start as in_period,
           case when sm.movement_type = 'VOID_REVERSAL' then coalesce((
             select o.movement_type from public.stock_movements o
              where o.ref_type = sm.ref_type and o.ref_id = sm.ref_id and o.item_id = sm.item_id
                and o.location_id = sm.location_id and o.movement_type <> 'VOID_REVERSAL'
              limit 1), sm.movement_type)
           else sm.movement_type end as movement_type
      from public.stock_movements sm
     where sm.created_at < v_end
       and (p_location_id is null or sm.location_id = p_location_id)
  ),
  g as (
    select m.location_id, m.item_id,
      coalesce(sum(m.quantity_delta) filter (where not m.in_period), 0)::bigint as opening,
      coalesce(sum(m.quantity_delta) filter (where m.in_period and m.movement_type = 'INBOUND'), 0)::bigint as inbound,
      coalesce(sum(m.quantity_delta) filter (where m.in_period and m.movement_type in ('SHIPMENT_RECEIVE', 'SHIPMENT_RETURN')), 0)::bigint as received,
      coalesce(sum(m.quantity_delta) filter (where m.in_period and m.movement_type = 'PRODUCTION_RESULT'), 0)::bigint as produced,
      coalesce(-sum(m.quantity_delta) filter (where m.in_period and m.movement_type = 'PRODUCTION_CONSUME'), 0)::bigint as consumed,
      coalesce(-sum(m.quantity_delta) filter (where m.in_period and m.movement_type = 'SHIPMENT_PICKUP'), 0)::bigint as shipped,
      coalesce(-sum(m.quantity_delta) filter (where m.in_period and m.movement_type = 'DISTRIBUTION'), 0)::bigint as distributed,
      coalesce(sum(m.quantity_delta) filter (where m.in_period and m.movement_type in
        ('OPENING_BALANCE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'VOID_REVERSAL')), 0)::bigint as adjusted, -- void tanpa asal (tidak terjadi)
      sum(m.quantity_delta)::bigint as closing
    from m
    group by m.location_id, m.item_id
  )
  select g.location_id, l.name, g.item_id, i.sku, i.name, i.type, i.base_unit,
         g.opening, g.inbound, g.received, g.produced, g.consumed, g.shipped, g.distributed, g.adjusted, g.closing
    from g
    join public.items i on i.id = g.item_id
    join public.locations l on l.id = g.location_id
   order by l.name, i.sku;
end;
$$;

-- ---------------------------------------------------------------------
-- DASHBOARD — ringkasan per lokasi yang terlihat user.
-- ---------------------------------------------------------------------
create function public.get_dashboard()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_month date := date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date;
begin
  if app.my_role() is null then
    raise exception 'ACCOUNT_INACTIVE';
  end if;

  return jsonb_build_object(
    'today', v_today,
    'month_start', v_month,
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'code', l.code, 'name', l.name, 'type', l.type,
        'packaging_qty', coalesce((select sum(s.quantity) from public.stocks s join public.items i on i.id = s.item_id
                                   where s.location_id = l.id and i.type = 'PACKAGING'), 0),
        'finished_qty',  coalesce((select sum(s.quantity) from public.stocks s join public.items i on i.id = s.item_id
                                   where s.location_id = l.id and i.type = 'FINISHED_GOOD'), 0),
        'low_count',     (select count(*) from public.stock_levels v where v.location_id = l.id and v.is_low
                            and exists (select 1 from public.stock_movements sm where sm.item_id = v.item_id and sm.location_id = l.id)),
        'production_today', (select jsonb_build_object('good', coalesce(sum(p.qty_good), 0), 'reject', coalesce(sum(p.qty_reject), 0))
                               from public.productions p where p.location_id = l.id and p.voided_at is null and p.production_date = v_today),
        'production_month', (select jsonb_build_object('good', coalesce(sum(p.qty_good), 0), 'reject', coalesce(sum(p.qty_reject), 0))
                               from public.productions p where p.location_id = l.id and p.voided_at is null and p.production_date >= v_month),
        'distribution_today', (select coalesce(sum(di.base_qty), 0) from public.distributions d join public.distribution_items di on di.distribution_id = d.id
                                 where d.location_id = l.id and d.voided_at is null and d.transaction_date = v_today),
        'distribution_month', (select coalesce(sum(di.base_qty), 0) from public.distributions d join public.distribution_items di on di.distribution_id = d.id
                                 where d.location_id = l.id and d.voided_at is null and d.transaction_date >= v_month),
        'incoming', (select count(*) from public.shipments sh where sh.to_location_id = l.id and sh.status = 'PICKED_UP'),
        'outgoing', (select count(*) from public.shipments sh where sh.from_location_id = l.id and sh.status in ('CREATED', 'ASSIGNED'))
      ) order by l.name)
        from public.locations l
       where l.is_active and l.deleted_at is null and app.has_location(l.id)
    ), '[]'::jsonb),
    'shipments', (
      select jsonb_build_object(
        'created',   count(*) filter (where status = 'CREATED'),
        'assigned',  count(*) filter (where status = 'ASSIGNED'),
        'picked_up', count(*) filter (where status = 'PICKED_UP'),
        'received_month', count(*) filter (where status = 'RECEIVED' and received_at >= (v_month::timestamp at time zone 'Asia/Jakarta')))
        from public.shipments
    ),
    -- Barang menipis (pernah ada transaksi di lokasi tsb), paling kritis dulu.
    'low_stock', coalesce((
      select jsonb_agg(x order by x->>'ratio', x->>'sku') from (
        select jsonb_build_object('location_name', v.location_name, 'sku', v.sku, 'item_name', v.item_name,
                                  'quantity', v.quantity, 'min_stock', v.min_stock, 'base_unit', v.base_unit,
                                  'ratio', lpad(((v.quantity * 1000) / greatest(v.min_stock, 1))::text, 8, '0')) as x
          from public.stock_levels v
         where v.is_low
           and exists (select 1 from public.stock_movements sm where sm.item_id = v.item_id and sm.location_id = v.location_id)
         order by (v.quantity::numeric / greatest(v.min_stock, 1)), v.sku
         limit 15
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.report_stock_mutation(date, date, uuid), public.get_dashboard() from public, anon;
grant execute on function public.report_stock_mutation(date, date, uuid), public.get_dashboard() to authenticated;

-- Admin Pabrik perlu nama buyer di laporan? Tidak (distribusi bukan wewenangnya).
-- Laporan distribusi/produksi/inbound/shipment dibaca langsung dari tabel lewat RLS.
