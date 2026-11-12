-- =====================================================================
-- PERBAIKAN UI (setelah Phase 7)
-- 1. Shipment: jenis barang dibatasi menurut tipe lokasi asal (permintaan owner):
--      Gudang packaging (WAREHOUSE)   → hanya PACKAGING (kemasan)
--      Gudang Penjualan               → hanya FINISHED_GOOD
--      Pabrik                         → keduanya
-- 2. Dashboard: alur bisnis (belanja kemasan → kirim ke pabrik → produksi →
--    kirim produk ke gudang penjualan → distribusi), aktivitas terbaru,
--    produk terlaris. Tetap SECURITY INVOKER (RLS berlaku).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Validasi jenis barang shipment
-- ---------------------------------------------------------------------
create function app.assert_shipment_item_types(p_from uuid, p_items jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_type public.location_type;
  v_bad text;
begin
  select type into v_type from public.locations where id = p_from;
  if v_type = 'FACTORY' then
    return;
  end if;
  select i.name into v_bad
    from jsonb_array_elements(p_items) l
    join public.items i on i.id = (l ->> 'item_id')::uuid
   where (v_type = 'WAREHOUSE' and i.type <> 'PACKAGING')
      or (v_type = 'SALES_WAREHOUSE' and i.type <> 'FINISHED_GOOD')
   limit 1;
  if v_bad is not null then
    raise exception 'INVALID_ITEM_TYPE: % tidak bisa dikirim dari lokasi ini (%)', v_bad,
      case v_type when 'WAREHOUSE' then 'gudang packaging hanya mengirim kemasan'
                  else 'gudang penjualan hanya mengirim produk jadi' end;
  end if;
end;
$$;
revoke all on function app.assert_shipment_item_types(uuid, jsonb) from public, anon, authenticated;

-- Pasang ke create_shipment lewat trigger pada shipment_items (berlaku untuk
-- semua jalur insert tanpa mengubah tanda tangan RPC yang sudah dipakai client).
create function app.shipment_item_type_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.assert_shipment_item_types(
    (select from_location_id from public.shipments where id = new.shipment_id),
    jsonb_build_array(jsonb_build_object('item_id', new.item_id))
  );
  return new;
end;
$$;
revoke all on function app.shipment_item_type_guard() from public, anon, authenticated;
create trigger shipment_items_type_guard before insert on public.shipment_items
  for each row execute function app.shipment_item_type_guard();

-- ---------------------------------------------------------------------
-- 2. Dashboard dengan alur bisnis
-- ---------------------------------------------------------------------
create or replace function public.get_dashboard()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_month date := date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date;
  v_month_ts timestamptz := (date_trunc('month', (now() at time zone 'Asia/Jakarta')))::timestamp at time zone 'Asia/Jakarta';
  v_today_ts timestamptz := ((now() at time zone 'Asia/Jakarta')::date)::timestamp at time zone 'Asia/Jakarta';
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
      ) order by l.type, l.name)
        from public.locations l
       where l.is_active and l.deleted_at is null and app.has_location(l.id)
    ), '[]'::jsonb),
    'shipments', (
      select jsonb_build_object(
        'created',   count(*) filter (where status = 'CREATED'),
        'assigned',  count(*) filter (where status = 'ASSIGNED'),
        'picked_up', count(*) filter (where status = 'PICKED_UP'),
        'received_month', count(*) filter (where status = 'RECEIVED' and received_at >= v_month_ts))
        from public.shipments
    ),
    -- Alur bisnis bulan ini & hari ini (satuan sachet). Angka mengikuti RLS user.
    'flow', (
      select jsonb_object_agg(
        period,
        jsonb_build_object(
          'inbound', (select coalesce(sum(ii.base_qty), 0) from public.inbound_transactions it join public.inbound_items ii on ii.inbound_id = it.id
                       where it.voided_at is null and it.transaction_date >= since_date),
          'packaging_to_factory', (select coalesce(sum(si.base_qty), 0) from public.shipments sh
                       join public.shipment_items si on si.shipment_id = sh.id join public.items i on i.id = si.item_id
                       join public.locations lt on lt.id = sh.to_location_id
                       where sh.status = 'RECEIVED' and sh.received_at >= since_ts and i.type = 'PACKAGING' and lt.type = 'FACTORY'),
          'produced', (select coalesce(sum(p.qty_good), 0) from public.productions p where p.voided_at is null and p.production_date >= since_date),
          'rejected', (select coalesce(sum(p.qty_reject), 0) from public.productions p where p.voided_at is null and p.production_date >= since_date),
          'goods_to_sales', (select coalesce(sum(si.base_qty), 0) from public.shipments sh
                       join public.shipment_items si on si.shipment_id = sh.id join public.items i on i.id = si.item_id
                       join public.locations lt on lt.id = sh.to_location_id
                       where sh.status = 'RECEIVED' and sh.received_at >= since_ts and i.type = 'FINISHED_GOOD' and lt.type = 'SALES_WAREHOUSE'),
          'distributed', (select coalesce(sum(di.base_qty), 0) from public.distributions d join public.distribution_items di on di.distribution_id = d.id
                       where d.voided_at is null and d.transaction_date >= since_date),
          'in_transit', (select coalesce(sum(si.base_qty), 0) from public.shipments sh join public.shipment_items si on si.shipment_id = sh.id
                       where sh.status = 'PICKED_UP')
        )
      )
      from (values ('month', v_month, v_month_ts), ('today', v_today, v_today_ts)) f(period, since_date, since_ts)
    ),
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
    ), '[]'::jsonb),
    -- Produk paling banyak keluar ke buyer bulan ini
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object('sku', sku, 'name', name, 'qty', qty) order by qty desc)
        from (
          select i.sku, i.name, sum(di.base_qty)::bigint as qty
            from public.distributions d join public.distribution_items di on di.distribution_id = d.id
            join public.items i on i.id = di.item_id
           where d.voided_at is null and d.transaction_date >= v_month
           group by i.sku, i.name
           order by qty desc
           limit 5
        ) t
    ), '[]'::jsonb),
    -- Aktivitas terbaru (12 dokumen terakhir yang terlihat user)
    'activity', coalesce((
      select jsonb_agg(a order by (a->>'at') desc)
        from (
          select jsonb_build_object('at', at, 'kind', kind, 'id', id, 'doc_no', doc_no, 'title', title, 'qty', qty, 'voided', voided) as a
            from (
              select it.created_at as at, 'INBOUND' as kind, it.id, it.doc_no,
                     coalesce((select v.name from public.vendors v where v.id = it.vendor_id), 'Vendor') || ' → ' ||
                       coalesce((select l.name from public.locations l where l.id = it.location_id), '') as title,
                     (select coalesce(sum(ii.base_qty), 0) from public.inbound_items ii where ii.inbound_id = it.id) as qty,
                     it.voided_at is not null as voided
                from public.inbound_transactions it
              union all
              select sh.updated_at, 'SHIPMENT_' || sh.status::text, sh.id, sh.doc_no,
                     coalesce((select l.name from public.locations l where l.id = sh.from_location_id), '') || ' → ' ||
                       coalesce((select l.name from public.locations l where l.id = sh.to_location_id), ''),
                     (select coalesce(sum(si.base_qty), 0) from public.shipment_items si where si.shipment_id = sh.id),
                     false
                from public.shipments sh
              union all
              select p.created_at, 'PRODUCTION', p.id, p.doc_no,
                     coalesce((select i.name from public.items i where i.id = p.finished_item_id), '') || ' · ' ||
                       coalesce((select l.name from public.locations l where l.id = p.location_id), ''),
                     coalesce(p.qty_good, 0), p.voided_at is not null
                from public.productions p
              union all
              select d.created_at, 'DISTRIBUTION', d.id, d.doc_no,
                     coalesce((select l.name from public.locations l where l.id = d.location_id), '') || ' → ' || d.buyer_name,
                     (select coalesce(sum(di.base_qty), 0) from public.distribution_items di where di.distribution_id = d.id),
                     d.voided_at is not null
                from public.distributions d
            ) e
           order by at desc
           limit 12
        ) t
    ), '[]'::jsonb)
  );
end;
$$;
