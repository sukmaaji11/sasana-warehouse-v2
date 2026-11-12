-- Phase 5: produksi — konsumsi good + reject, validasi pabrik/produk, hak akses,
-- idempotency, atomik saat stok kurang, void, dan role ADMIN_PABRIK.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- ---------- fixtures ----------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'tst5.so@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'tst5.op@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b3', 'tst5.ap@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b4', 'tst5.ap2@users.sasana.internal', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b5', 'tst5.ag@users.sasana.internal',  'authenticated', 'authenticated');
insert into public.profiles (id, username, full_name, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'tst5.so',  'SO',     'SUPER_OWNER'),
  ('00000000-0000-0000-0000-0000000000b2', 'tst5.op',  'OP CLP', 'OWNER_PABRIK'),
  ('00000000-0000-0000-0000-0000000000b3', 'tst5.ap',  'AP CLP', 'ADMIN_PABRIK'),
  ('00000000-0000-0000-0000-0000000000b4', 'tst5.ap2', 'AP KMJ', 'ADMIN_PABRIK'),
  ('00000000-0000-0000-0000-0000000000b5', 'tst5.ag',  'AG',     'ADMIN_GUDANG');
insert into public.user_locations (user_id, location_id)
select '00000000-0000-0000-0000-0000000000b2'::uuid, id from public.locations where code = 'PBR-CLP'
union all select '00000000-0000-0000-0000-0000000000b3'::uuid, id from public.locations where code = 'PBR-CLP'
union all select '00000000-0000-0000-0000-0000000000b4'::uuid, id from public.locations where code = 'PBR-KMJ'
union all select '00000000-0000-0000-0000-0000000000b5'::uuid, id from public.locations where code = 'GDG-KMB';

-- FG-006 diproduksi di Cilacap (Q8), packaging-nya PKG-006 (1:1). FG-001 milik Kemranjen.
create temp table t as
select
  (select id from public.items where sku = 'PKG-006') as pkg,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'PKG-006' and u.is_base) as pkg_unit,
  (select id from public.items where sku = 'FG-006') as fg,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-006' and u.is_base) as fg_base,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-006' and u.unit_name = 'dus') as fg_dus,
  (select u.factor from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-006' and u.unit_name = 'dus') as dus,
  (select id from public.items where sku = 'FG-001') as fg_kmj,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-001' and u.is_base) as fg_kmj_base,
  (select id from public.locations where code = 'GDG-KMB') as hub,
  (select id from public.locations where code = 'PBR-CLP') as clp,
  (select id from public.locations where code = 'PBR-KMJ') as kmj,
  (now() at time zone 'Asia/Jakarta')::date as today;
grant select on t to authenticated;

create function pg_temp.qty(p_item uuid, p_loc uuid) returns bigint language sql as
  $$ select coalesce((select quantity from public.stocks where item_id = p_item and location_id = p_loc), 0) $$;

-- Stok Cilacap diset ABSOLUT oleh fixture (packaging 1.000, produk 0), tidak bergantung isi DB.
create temp table b as select 0::bigint as pkg_clp,
                              0::bigint as fg_clp,
                              pg_temp.qty((select pkg from t), (select hub from t)) as pkg_hub;
grant select on b to authenticated;

-- stok packaging pabrik +1.000 sachet, gudang +100 (untuk shipment)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1"}';
select lives_ok($$select public.create_stock_adjustment(gen_random_uuid(), 'ADJUSTMENT', (select clp from t), 'fixture', (select today from t),
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'physical_qty', 1000),
                    jsonb_build_object('item_id', (select fg from t), 'physical_qty', 0)))$$, 'fixture packaging pabrik');
select lives_ok($$select public.create_stock_adjustment(gen_random_uuid(), 'ADJUSTMENT', (select hub from t), 'fixture', (select today from t),
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'physical_qty', (select pkg_hub from b) + 100)))$$, 'fixture packaging gudang');

-- ---------- hak input (Q10) ----------
select throws_like($$select public.create_production(gen_random_uuid(), (select clp from t), (select fg from t), (select fg_base from t), 10, 0, (select today from t), null)$$,
  'FORBIDDEN%', 'super owner tidak boleh input produksi');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b5"}';
select throws_like($$select public.create_production(gen_random_uuid(), (select clp from t), (select fg from t), (select fg_base from t), 10, 0, (select today from t), null)$$,
  'FORBIDDEN%', 'admin gudang tidak boleh input produksi');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b4"}';
select throws_like($$select public.create_production(gen_random_uuid(), (select clp from t), (select fg from t), (select fg_base from t), 10, 0, (select today from t), null)$$,
  'FORBIDDEN_LOCATION%', 'admin pabrik Kemranjen tidak boleh input di Cilacap');
reset role;

-- ---------- ADMIN_PABRIK Cilacap ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3"}';
select throws_like($$select public.create_production(gen_random_uuid(), (select clp from t), (select fg_kmj from t), (select fg_kmj_base from t), 10, 0, (select today from t), null)$$,
  'VALIDATION%tidak terdaftar%', 'produk Kemranjen ditolak di Cilacap (Q8)');
select throws_like($$select public.create_production(gen_random_uuid(), (select clp from t), (select fg from t), (select pkg_unit from t), 10, 0, (select today from t), null)$$,
  'VALIDATION%satuan%', 'satuan milik barang lain ditolak');
select throws_like($$select public.create_production(gen_random_uuid(), (select clp from t), (select fg from t), (select fg_base from t), 0, 0, (select today from t), null)$$,
  'VALIDATION%', 'good dan reject nol ditolak');
select throws_like($$select public.create_production(gen_random_uuid(), (select clp from t), (select fg from t), (select fg_base from t), -5, 0, (select today from t), null)$$,
  'VALIDATION%', 'jumlah negatif ditolak');
select throws_like($$select public.create_production(gen_random_uuid(), (select clp from t), (select fg from t), (select fg_base from t), 10, 0, (select today from t) + 1, null)$$,
  'VALIDATION%masa depan%', 'tanggal masa depan ditolak');
select throws_like($$select public.create_production(gen_random_uuid(), (select clp from t), (select fg from t), (select fg_base from t), 10, 0, (select today from t) - 8, null)$$,
  'VALIDATION%7 hari%', 'tanggal lebih dari 7 hari ke belakang ditolak (Q16)');

-- 1 dus good + 20 reject
select lives_ok($$select public.create_production('55555555-0000-0000-0000-000000000001', (select clp from t), (select fg from t), (select fg_dus from t), 1, 20, (select today from t) - 1, 'shift pagi')$$,
  'admin pabrik input produksi 1 dus + 20 reject');
select is((select doc_no like 'PRD-%' from public.productions where idempotency_key = '55555555-0000-0000-0000-000000000001'), true, 'nomor dokumen PRD-');
select is((select packaging_consumed from public.productions where idempotency_key = '55555555-0000-0000-0000-000000000001'), (select dus from t)::bigint + 20,
  'packaging terpakai = good + reject');
select is((public.create_production('55555555-0000-0000-0000-000000000001', (select clp from t), (select fg from t), (select fg_dus from t), 1, 20, (select today from t) - 1, null) ->> 'replayed'),
  'true', 'key sama → replayed');
reset role;

select is(pg_temp.qty((select pkg from t), (select clp from t)), (select pkg_clp from b) + 1000 - (select dus from t) - 20, 'packaging berkurang good + reject (sekali saja)');
select is(pg_temp.qty((select fg from t), (select clp from t)), (select fg_clp from b) + (select dus from t), 'produk jadi bertambah sebanyak good');

-- stok kurang → seluruh transaksi batal
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3"}';
select throws_like($$select public.create_production(gen_random_uuid(), (select clp from t), (select fg from t), (select fg_base from t), 1000, 0, (select today from t), null)$$,
  'INSUFFICIENT_STOCK%', 'packaging kurang → ditolak');
reset role;
select is(pg_temp.qty((select fg from t), (select clp from t)), (select fg_clp from b) + (select dus from t), 'produk jadi tidak bertambah saat produksi gagal (atomik)');
select is((select count(*)::int from public.productions where created_by = '00000000-0000-0000-0000-0000000000b3'), 1, 'produksi gagal tidak tersimpan');

-- reject saja (good 0): tidak ada movement PRODUCTION_RESULT
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3"}';
select lives_ok($$select public.create_production('55555555-0000-0000-0000-000000000002', (select clp from t), (select fg from t), (select fg_base from t), 0, 10, (select today from t), 'mesin bocor')$$,
  'reject saja diterima');
reset role;
select is((select count(*)::int from public.stock_movements m join public.productions p on p.id = m.ref_id
            where m.ref_type = 'production' and p.idempotency_key = '55555555-0000-0000-0000-000000000002' and m.movement_type = 'PRODUCTION_RESULT'),
  0, 'reject saja tidak menambah produk jadi');

-- ---------- visibilitas ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b4"}';
select is((select count(*)::int from public.productions where location_id = (select clp from t)), 0, 'admin pabrik Kemranjen tidak melihat produksi Cilacap');
select is((select count(*)::int from public.stocks where location_id = (select clp from t)), 0, 'admin pabrik Kemranjen tidak melihat stok Cilacap');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3"}';
select is((select count(*)::int from public.productions where created_by = '00000000-0000-0000-0000-0000000000b3'), 2, 'admin pabrik melihat produksi pabriknya');
select ok((select count(*) from public.stock_levels where location_id = (select clp from t)) > 0, 'admin pabrik melihat stok pabriknya');
select is((select count(*)::int from public.stocks where location_id = (select hub from t)), 0, 'admin pabrik tidak melihat stok gudang');

-- ---------- void ----------
select throws_like($$select public.void_transaction('production', (select id from public.productions where idempotency_key = '55555555-0000-0000-0000-000000000001'), 'salah input')$$,
  'FORBIDDEN%', 'admin pabrik tidak boleh void');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2"}';
select throws_like($$select public.void_transaction('inbound', gen_random_uuid(), 'x')$$, 'FORBIDDEN%', 'owner pabrik tidak boleh void inbound');
select lives_ok($$select public.void_transaction('production', (select id from public.productions where idempotency_key = '55555555-0000-0000-0000-000000000001'), 'salah input')$$,
  'owner pabrik void produksi pabriknya');
select is((public.void_transaction('production', (select id from public.productions where idempotency_key = '55555555-0000-0000-0000-000000000001'), 'lagi') ->> 'replayed'),
  'true', 'void kedua → replayed');
reset role;
select is(pg_temp.qty((select pkg from t), (select clp from t)), (select pkg_clp from b) + 1000 - 10, 'void mengembalikan packaging');
select is(pg_temp.qty((select fg from t), (select clp from t)), (select fg_clp from b), 'void mengurangi produk jadi');

-- void ditolak bila produk hasil produksi sudah terpakai
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3"}';
select lives_ok($$select public.create_production('55555555-0000-0000-0000-000000000003', (select clp from t), (select fg from t), (select fg_dus from t), 1, 0, (select today from t), null)$$,
  'produksi ketiga');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1"}';
select lives_ok($$select public.create_stock_adjustment(gen_random_uuid(), 'ADJUSTMENT', (select clp from t), 'produk terpakai', (select today from t),
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'physical_qty', (select fg_clp from b))))$$, 'produk jadi berkurang (terpakai)');
select throws_like($$select public.void_transaction('production', (select id from public.productions where idempotency_key = '55555555-0000-0000-0000-000000000003'), 'x')$$,
  'INSUFFICIENT_STOCK%', 'void ditolak karena produk sudah terpakai');

-- ---------- ADMIN_PABRIK: receive shipment, tidak bisa buat shipment / inbound ----------
select lives_ok($$select public.create_shipment('55555555-0000-0000-0000-0000000000f1', (select hub from t), (select clp from t), null, null,
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 50)))$$, 'SO membuat shipment ke Cilacap');
reset role;
-- driver langsung di-set sebagai postgres agar test tidak bergantung pada akun driver
update public.shipments set status = 'PICKED_UP', driver_id = '00000000-0000-0000-0000-0000000000b5', picked_up_by = '00000000-0000-0000-0000-0000000000b1',
       picked_up_at = now() where idempotency_key = '55555555-0000-0000-0000-0000000000f1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3"}';
select lives_ok($$select public.receive_shipment((select id from public.shipments where idempotency_key = '55555555-0000-0000-0000-0000000000f1'))$$,
  'admin pabrik menerima shipment di pabriknya');
select throws_like($$select public.create_shipment(gen_random_uuid(), (select clp from t), (select hub from t), null, null,
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 1)))$$,
  'FORBIDDEN_LOCATION%', 'admin pabrik tidak membuat shipment');
reset role;

-- ledger tetap konsisten
select is(
  (select count(*)::int from public.stocks s
    where s.location_id = (select clp from t)
      and s.quantity <> (select coalesce(sum(quantity_delta), 0) from public.stock_movements m
                          where m.item_id = s.item_id and m.location_id = s.location_id)),
  0, 'saldo = jumlah movement (ledger) di Cilacap');

select * from finish();
rollback;
