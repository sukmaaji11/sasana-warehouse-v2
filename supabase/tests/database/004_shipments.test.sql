-- Phase 4: shipment internal — status, stok, hak akses, idempotency.
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- ---------- fixtures ----------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'tst4.so@users.sasana.internal',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'tst4.ag@users.sasana.internal',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'tst4.op@users.sasana.internal',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'tst4.drv@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'tst4.drv2@users.sasana.internal', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a6', 'tst4.op2@users.sasana.internal',  'authenticated', 'authenticated');
insert into public.profiles (id, username, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'tst4.so',   'SO',      'SUPER_OWNER'),
  ('00000000-0000-0000-0000-0000000000a2', 'tst4.ag',   'AG',      'ADMIN_GUDANG'),
  ('00000000-0000-0000-0000-0000000000a3', 'tst4.op',   'OP CLP',  'OWNER_PABRIK'),
  ('00000000-0000-0000-0000-0000000000a4', 'tst4.drv',  'Driver1', 'DRIVER'),
  ('00000000-0000-0000-0000-0000000000a5', 'tst4.drv2', 'Driver2', 'DRIVER'),
  ('00000000-0000-0000-0000-0000000000a6', 'tst4.op2',  'OP KMJ',  'OWNER_PABRIK');
insert into public.user_locations (user_id, location_id)
select '00000000-0000-0000-0000-0000000000a2'::uuid, id from public.locations where code = 'GDG-KMB'
union all select '00000000-0000-0000-0000-0000000000a3'::uuid, id from public.locations where code = 'PBR-CLP'
union all select '00000000-0000-0000-0000-0000000000a6'::uuid, id from public.locations where code = 'PBR-KMJ';

create temp table t as
select
  (select id from public.items where sku = 'PKG-006') as pkg,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'PKG-006' and u.is_base) as pkg_unit,
  (select id from public.items where sku = 'FG-006') as fg,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-006' and u.unit_name = 'dus') as fg_dus,
  (select id from public.locations where code = 'GDG-KMB') as hub,
  (select id from public.locations where code = 'PBR-CLP') as clp,
  (select id from public.locations where code = 'PBR-KMJ') as kmj;
grant select on t to authenticated;

-- helper saldo (sebagai postgres)
create function pg_temp.qty(p_item uuid, p_loc uuid) returns bigint language sql as
  $$ select coalesce((select quantity from public.stocks where item_id = p_item and location_id = p_loc), 0) $$;

-- stok awal: 1.000 sachet PKG-006 di gudang, 2 dus (800) FG-006 di Cilacap (baseline + selisih)
create temp table b as select pg_temp.qty((select pkg from t), (select hub from t)) as pkg_hub,
                              pg_temp.qty((select pkg from t), (select clp from t)) as pkg_clp,
                              pg_temp.qty((select fg from t), (select clp from t)) as fg_clp,
                              pg_temp.qty((select fg from t), (select kmj from t)) as fg_kmj;
grant select on b to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
select lives_ok($$select public.create_stock_adjustment(gen_random_uuid(), 'ADJUSTMENT', (select hub from t), 'fixture', (now() at time zone 'Asia/Jakarta')::date,
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'physical_qty', (select pkg_hub from b) + 1000)))$$, 'fixture stok gudang');
select lives_ok($$select public.create_stock_adjustment(gen_random_uuid(), 'ADJUSTMENT', (select clp from t), 'fixture', (now() at time zone 'Asia/Jakarta')::date,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'physical_qty', (select fg_clp from b) + 800)))$$, 'fixture stok pabrik');
reset role;

-- ---------- ADMIN_GUDANG: create (tanpa driver) ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2"}';
select lives_ok($$select public.create_shipment('44444444-0000-0000-0000-000000000001', (select hub from t), (select clp from t), null, 'kirim packaging',
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 600)))$$, 'admin gudang membuat shipment');
select is((select status::text from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'), 'CREATED', 'tanpa driver → CREATED');
select is(
  (public.create_shipment('44444444-0000-0000-0000-000000000001', (select hub from t), (select clp from t), null, 'x',
     jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 600))) ->> 'replayed'),
  'true', 'create dengan key sama → replayed');
select throws_like($$select public.create_shipment(gen_random_uuid(), (select clp from t), (select hub from t), null, null,
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 1)))$$,
  'FORBIDDEN_LOCATION%', 'admin gudang tidak bisa membuat shipment dari pabrik');
select throws_like($$select public.create_shipment(gen_random_uuid(), (select hub from t), (select hub from t), null, null,
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 1)))$$,
  'VALIDATION%', 'asal = tujuan ditolak');
select is(pg_temp.qty((select pkg from t), (select hub from t)), (select pkg_hub from b) + 1000, 'create tidak mengubah stok');

select throws_like($$select public.pickup_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'))$$,
  'INVALID_STATUS%', 'pickup tanpa driver ditolak');
select lives_ok($$select public.assign_shipment_driver((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-0000000000a4')$$,
  'assign driver 1');
select lives_ok($$select public.assign_shipment_driver((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-0000000000a5')$$,
  'ganti ke driver 2 (Q12)');
select throws_like($$select public.assign_shipment_driver((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-0000000000a3')$$,
  'VALIDATION%', 'yang ditugaskan harus role DRIVER');
select is(pg_temp.qty((select pkg from t), (select hub from t)), (select pkg_hub from b) + 1000, 'assign tidak mengubah stok');
reset role;

create temp table s1 as select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001';
grant select on s1 to authenticated;

-- ---------- DRIVER ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4"}';
select is((select count(*)::int from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'), 0, 'driver lama tidak lagi melihat shipment yang dialihkan');
select throws_like($$select public.pickup_shipment((select id from s1))$$, 'FORBIDDEN%', 'driver lama tidak bisa pickup shipment yang dialihkan');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5"}';
select is((select count(*)::int from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'), 1, 'driver baru melihat tugasnya');
select is((select count(*)::int from public.shipment_items si join public.shipments s on s.id = si.shipment_id where s.idempotency_key = '44444444-0000-0000-0000-000000000001'), 1, 'driver melihat barang di shipment-nya');
select is((select count(*)::int from public.stocks), 0, 'driver tidak melihat stok');
select lives_ok($$select public.pickup_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'))$$, 'driver pickup');
select is((select picked_up_on_behalf from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'), false, 'pickup oleh driver sendiri');
select is((public.pickup_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001')) ->> 'replayed'), 'true', 'pickup kedua → replayed');
select throws_like($$select public.receive_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'))$$,
  'FORBIDDEN%', 'driver tidak bisa receive');
reset role;

select is(pg_temp.qty((select pkg from t), (select hub from t)), (select pkg_hub from b) + 400, 'pickup mengurangi stok asal 600 (sekali saja)');
select is(pg_temp.qty((select pkg from t), (select clp from t)), (select pkg_clp from b), 'stok tujuan belum bertambah (dalam perjalanan)');

-- ---------- OWNER_PABRIK KMJ (bukan tujuan) & CLP (tujuan): receive ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a6"}';
select throws_like($$select public.receive_shipment('00000000-0000-0000-0000-000000000000')$$, 'NOT_FOUND%', 'id tidak ada');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3"}';
select lives_ok($$select public.receive_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'))$$, 'owner pabrik tujuan receive');
select is((public.receive_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001')) ->> 'replayed'), 'true', 'receive kedua → replayed');
select throws_like($$select public.cancel_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000001'), 'x')$$,
  'INVALID_STATUS%', 'shipment RECEIVED tidak bisa dibatalkan');
reset role;
select is(pg_temp.qty((select pkg from t), (select clp from t)), (select pkg_clp from b) + 600, 'receive menambah stok tujuan 600');

-- ---------- OWNER_PABRIK CLP: produk jadi ke Kemranjen (Q4) + pickup atas nama driver (Q12) ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3"}';
select lives_ok($$select public.create_shipment('44444444-0000-0000-0000-000000000002', (select clp from t), (select kmj from t), '00000000-0000-0000-0000-0000000000a4', 'FG ke Kemranjen',
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_dus from t), 'qty', 3)))$$, 'owner pabrik kirim 3 dus FG ke Kemranjen');
select is((select base_qty from public.shipment_items si join public.shipments s on s.id = si.shipment_id where s.idempotency_key = '44444444-0000-0000-0000-000000000002'), 1200::bigint, '3 dus dikonversi = 1.200 sachet (snapshot faktor)');
select throws_like($$select public.pickup_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000002'))$$,
  'INSUFFICIENT_STOCK%', 'stok kurang (800 < 1200) → pickup ditolak, tidak ada perubahan');
select is((select status::text from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000002'), 'ASSIGNED', 'status tetap ASSIGNED setelah gagal');
reset role;

-- ubah jadi 2 dus lewat shipment baru (shipment bisa dibatalkan sebelum pickup)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3"}';
select lives_ok($$select public.cancel_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000002'), 'Jumlah salah')$$, 'owner pabrik batalkan sebelum pickup');
select lives_ok($$select public.create_shipment('44444444-0000-0000-0000-000000000003', (select clp from t), (select kmj from t), '00000000-0000-0000-0000-0000000000a4', null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_dus from t), 'qty', 2)))$$, 'shipment 2 dus');
select lives_ok($$select public.pickup_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000003'))$$, 'owner pabrik pickup atas nama driver');
select is((select picked_up_on_behalf from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000003'), true, 'tercatat pickup atas nama driver');
select throws_like($$select public.cancel_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000003'), 'x')$$,
  'FORBIDDEN%', 'owner pabrik tidak bisa batal kirim setelah pickup');
reset role;

-- ---------- SUPER_OWNER: batal kirim setelah pickup → stok kembali ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
select lives_ok($$select public.cancel_shipment((select id from public.shipments where idempotency_key = '44444444-0000-0000-0000-000000000003'), 'Truk batal berangkat')$$, 'super owner batal kirim');
reset role;
select is(pg_temp.qty((select fg from t), (select clp from t)), (select fg_clp from b) + 800, 'stok FG Cilacap kembali utuh (SHIPMENT_RETURN)');
select is(pg_temp.qty((select fg from t), (select kmj from t)), (select fg_kmj from b), 'stok Kemranjen tidak berubah');

select is(
  (select count(*)::int from public.stocks s
    where s.quantity <> coalesce((select sum(quantity_delta) from public.stock_movements m where m.item_id = s.item_id and m.location_id = s.location_id), 0)),
  0, 'ledger konsisten');

select * from finish();
rollback;
