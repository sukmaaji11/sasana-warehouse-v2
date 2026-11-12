-- Perbaikan UI: jenis barang shipment per tipe lokasi asal + alur dashboard.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'tst8.so@users.sasana.internal', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e2', 'tst8.op@users.sasana.internal', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e3', 'tst8.drv@users.sasana.internal', 'authenticated', 'authenticated');
insert into public.profiles (id, username, full_name, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'tst8.so', 'SO', 'SUPER_OWNER'),
  ('00000000-0000-0000-0000-0000000000e2', 'tst8.op', 'OP CLP', 'OWNER_PABRIK'),
  ('00000000-0000-0000-0000-0000000000e3', 'tst8.drv', 'Driver', 'DRIVER');
insert into public.user_locations (user_id, location_id)
select '00000000-0000-0000-0000-0000000000e2'::uuid, id from public.locations where code = 'PBR-CLP';

create temp table t as
select
  (select id from public.items where sku = 'PKG-006') as pkg,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'PKG-006' and u.is_base) as pkg_unit,
  (select id from public.items where sku = 'FG-006') as fg,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-006' and u.is_base) as fg_unit,
  (select id from public.locations where code = 'GDG-KMB') as hub,
  (select id from public.locations where code = 'PBR-CLP') as clp,
  (select id from public.locations where code = 'PBR-KMJ') as kmj,
  (select id from public.locations where code = 'GPJ-KMB') as gpj,
  (now() at time zone 'Asia/Jakarta')::date as today;
grant select on t to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1"}';

-- ---------- jenis barang per lokasi asal ----------
select throws_like($$select public.create_shipment(gen_random_uuid(), (select hub from t), (select clp from t), null, null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_unit from t), 'qty', 1)))$$,
  'INVALID_ITEM_TYPE%kemasan%', 'gudang packaging tidak boleh kirim produk jadi');
select throws_like($$select public.create_shipment(gen_random_uuid(), (select hub from t), (select clp from t), null, null,
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 1),
                    jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_unit from t), 'qty', 1)))$$,
  'INVALID_ITEM_TYPE%', 'campuran kemasan + produk jadi dari gudang packaging ditolak');
select lives_ok($$select public.create_shipment(gen_random_uuid(), (select hub from t), (select clp from t), null, null,
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 1)))$$,
  'gudang packaging kirim kemasan: boleh');
select throws_like($$select public.create_shipment(gen_random_uuid(), (select gpj from t), (select clp from t), null, null,
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 1)))$$,
  'INVALID_ITEM_TYPE%produk jadi%', 'gudang penjualan tidak boleh kirim kemasan');
select lives_ok($$select public.create_shipment(gen_random_uuid(), (select gpj from t), (select clp from t), null, null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_unit from t), 'qty', 1)))$$,
  'gudang penjualan kirim produk jadi: boleh');
select lives_ok($$select public.create_shipment(gen_random_uuid(), (select clp from t), (select kmj from t), null, null,
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 1),
                    jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_unit from t), 'qty', 1)))$$,
  'pabrik boleh kirim kemasan & produk jadi');

-- ---------- alur dashboard (selisih sebelum/sesudah) ----------
create temp table f0 as select public.get_dashboard() -> 'flow' -> 'month' as j;
-- kemasan 500 → shipment gudang → pabrik diterima
select lives_ok($$select public.create_stock_adjustment(gen_random_uuid(), 'ADJUSTMENT', (select hub from t), 'fixture', (select today from t),
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'physical_qty',
    (select coalesce((select quantity from public.stocks where item_id = (select pkg from t) and location_id = (select hub from t)), 0)) + 500)))$$, 'fixture kemasan');
select lives_ok($$select public.create_shipment('88888888-0000-0000-0000-000000000001', (select hub from t), (select clp from t), '00000000-0000-0000-0000-0000000000e3', null,
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 500)))$$, 'shipment kemasan');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e3"}';
select lives_ok($$select public.pickup_shipment((select id from public.shipments where idempotency_key = '88888888-0000-0000-0000-000000000001'))$$, 'pickup');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e2"}';
select lives_ok($$select public.receive_shipment((select id from public.shipments where idempotency_key = '88888888-0000-0000-0000-000000000001'))$$, 'diterima pabrik');
select lives_ok($$select public.create_production(gen_random_uuid(), (select clp from t), (select fg from t), (select fg_unit from t), 300, 10, (select today from t), null)$$, 'produksi');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1"}';
create temp table f1 as select public.get_dashboard() -> 'flow' -> 'month' as j;
select is(((select j from f1) ->> 'packaging_to_factory')::int - ((select j from f0) ->> 'packaging_to_factory')::int, 500,
  'alur: kemasan diterima pabrik +500');
select is(((select j from f1) ->> 'produced')::int - ((select j from f0) ->> 'produced')::int, 300, 'alur: produksi +300');
select ok(jsonb_array_length(public.get_dashboard() -> 'activity') between 1 and 12, 'aktivitas terbaru maksimal 12');
reset role;

select * from finish();
rollback;
