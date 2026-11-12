-- Phase 6: distribusi — hak input per role/lokasi, stok berkurang, atomik,
-- idempotency, void, visibilitas, buyer konsumsi internal.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- ---------- fixtures ----------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'tst6.so@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'tst6.op@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'tst6.ap@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c4', 'tst6.ag@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c5', 'tst6.ag2@users.sasana.internal', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c6', 'tst6.op2@users.sasana.internal', 'authenticated', 'authenticated');
insert into public.profiles (id, username, full_name, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'tst6.so',  'SO',         'SUPER_OWNER'),
  ('00000000-0000-0000-0000-0000000000c2', 'tst6.op',  'OP CLP',     'OWNER_PABRIK'),
  ('00000000-0000-0000-0000-0000000000c3', 'tst6.ap',  'AP CLP',     'ADMIN_PABRIK'),
  ('00000000-0000-0000-0000-0000000000c4', 'tst6.ag',  'AG GPJ',     'ADMIN_GUDANG'),
  ('00000000-0000-0000-0000-0000000000c5', 'tst6.ag2', 'AG GDG',     'ADMIN_GUDANG'),
  ('00000000-0000-0000-0000-0000000000c6', 'tst6.op2', 'OP KMJ',     'OWNER_PABRIK');
insert into public.user_locations (user_id, location_id)
select '00000000-0000-0000-0000-0000000000c2'::uuid, id from public.locations where code = 'PBR-CLP'
union all select '00000000-0000-0000-0000-0000000000c3'::uuid, id from public.locations where code = 'PBR-CLP'
union all select '00000000-0000-0000-0000-0000000000c4'::uuid, id from public.locations where code = 'GPJ-KMB'
union all select '00000000-0000-0000-0000-0000000000c5'::uuid, id from public.locations where code = 'GDG-KMB'
union all select '00000000-0000-0000-0000-0000000000c6'::uuid, id from public.locations where code = 'PBR-KMJ';

create temp table t as
select
  (select id from public.items where sku = 'FG-006') as fg,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-006' and u.is_base) as fg_base,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-006' and u.unit_name = 'dus') as fg_dus,
  (select u.factor from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-006' and u.unit_name = 'dus') as dus,
  (select id from public.items where sku = 'FG-007') as fg2,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-007' and u.is_base) as fg2_base,
  (select id from public.items where sku = 'PKG-006') as pkg,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'PKG-006' and u.is_base) as pkg_unit,
  (select id from public.locations where code = 'GDG-KMB') as hub,
  (select id from public.locations where code = 'PBR-CLP') as clp,
  (select id from public.locations where code = 'GPJ-KMB') as gpj,
  (select id from public.buyers where name = 'Konsumsi internal – Rawatan ayam') as internal,
  (now() at time zone 'Asia/Jakarta')::date as today;
insert into public.buyers (name) values ('tst6 Toko A');
insert into public.buyers (name, is_active) values ('tst6 Toko Nonaktif', false);
create temp table bb as select
  (select id from public.buyers where name = 'tst6 Toko A') as toko,
  (select id from public.buyers where name = 'tst6 Toko Nonaktif') as nonaktif;
grant select on t, bb to authenticated;

create function pg_temp.qty(p_item uuid, p_loc uuid) returns bigint language sql as
  $$ select coalesce((select quantity from public.stocks where item_id = p_item and location_id = p_loc), 0) $$;
-- Stok diset ABSOLUT oleh fixture, tidak bergantung isi DB.
create temp table b as select 0::bigint as fg_clp, 0::bigint as fg2_clp, 0::bigint as fg_gpj;
grant select on b to authenticated;

select ok((select internal from t) is not null, 'buyer "Konsumsi internal – Rawatan ayam" tersedia');

-- stok produk: Cilacap FG-006 +2.000, FG-007 +100; Gudang Penjualan FG-006 +500
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1"}';
select lives_ok($$select public.create_stock_adjustment(gen_random_uuid(), 'ADJUSTMENT', (select clp from t), 'fixture', (select today from t),
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'physical_qty', 2000),
                    jsonb_build_object('item_id', (select fg2 from t), 'physical_qty', 100)))$$, 'fixture stok pabrik');
select lives_ok($$select public.create_stock_adjustment(gen_random_uuid(), 'ADJUSTMENT', (select gpj from t), 'fixture', (select today from t),
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'physical_qty', 500)))$$, 'fixture stok gudang penjualan');

-- ---------- hak input ----------
select throws_like($$select public.create_distribution(gen_random_uuid(), (select clp from t), (select toko from bb), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 1)))$$,
  'FORBIDDEN%', 'super owner tidak input distribusi');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3"}';
select throws_like($$select public.create_distribution(gen_random_uuid(), (select clp from t), (select toko from bb), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 1)))$$,
  'FORBIDDEN%', 'admin pabrik tidak input distribusi');
select is((select count(*)::int from public.distributions), 0, 'admin pabrik tidak melihat distribusi');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c5"}';
select throws_like($$select public.create_distribution(gen_random_uuid(), (select hub from t), (select toko from bb), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 1)))$$,
  'FORBIDDEN_LOCATION%', 'admin gudang packaging tidak distribusi dari gudang packaging');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c6"}';
select throws_like($$select public.create_distribution(gen_random_uuid(), (select clp from t), (select toko from bb), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 1)))$$,
  'FORBIDDEN_LOCATION%', 'owner pabrik Kemranjen tidak distribusi dari Cilacap');
reset role;

-- ---------- OWNER_PABRIK Cilacap ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2"}';
select throws_like($$select public.create_distribution(gen_random_uuid(), (select gpj from t), (select toko from bb), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 1)))$$,
  'FORBIDDEN_LOCATION%', 'owner pabrik tidak distribusi dari gudang penjualan');
select throws_like($$select public.create_distribution(gen_random_uuid(), (select clp from t), (select nonaktif from bb), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 1)))$$,
  'VALIDATION%buyer%', 'buyer nonaktif ditolak');
select throws_like($$select public.create_distribution(gen_random_uuid(), (select clp from t), (select toko from bb), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'unit_id', (select pkg_unit from t), 'qty', 1)))$$,
  'VALIDATION%', 'packaging tidak bisa didistribusikan');
select throws_like($$select public.create_distribution(gen_random_uuid(), (select clp from t), (select toko from bb), (select today from t), null, '[]'::jsonb)$$,
  'VALIDATION%', 'tanpa barang ditolak');
select throws_like($$select public.create_distribution(gen_random_uuid(), (select clp from t), (select toko from bb), (select today from t) - 8, null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 1)))$$,
  'VALIDATION%7 hari%', 'tanggal > 7 hari ke belakang ditolak');
select throws_like($$select public.create_distribution(gen_random_uuid(), (select clp from t), (select toko from bb), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 1),
                    jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_dus from t), 'qty', 1)))$$,
  'VALIDATION%dua kali%', 'produk ganda ditolak');

-- 2 dus FG-006 + 30 sachet FG-007 ke Toko A
select lives_ok($$select public.create_distribution('66666666-0000-0000-0000-000000000001', (select clp from t), (select toko from bb), (select today from t), 'nota 12',
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_dus from t), 'qty', 2),
                    jsonb_build_object('item_id', (select fg2 from t), 'unit_id', (select fg2_base from t), 'qty', 30)))$$,
  'owner pabrik distribusi dari pabriknya');
select is((select doc_no like 'DST-%' from public.distributions where idempotency_key = '66666666-0000-0000-0000-000000000001'), true, 'nomor dokumen DST-');
select is((select buyer_name from public.distributions where idempotency_key = '66666666-0000-0000-0000-000000000001'), 'tst6 Toko A', 'nama buyer di-snapshot');
select is((public.create_distribution('66666666-0000-0000-0000-000000000001', (select clp from t), (select toko from bb), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_dus from t), 'qty', 2))) ->> 'replayed'),
  'true', 'key sama → replayed');
reset role;
select is(pg_temp.qty((select fg from t), (select clp from t)), (select fg_clp from b) + 2000 - 2 * (select dus from t), 'FG-006 berkurang 2 dus (sekali saja)');
select is(pg_temp.qty((select fg2 from t), (select clp from t)), (select fg2_clp from b) + 70, 'FG-007 berkurang 30');
select is((select count(*)::int from public.stock_movements m join public.distributions d on d.id = m.ref_id
            where m.ref_type = 'distribution' and d.idempotency_key = '66666666-0000-0000-0000-000000000001' and m.movement_type = 'DISTRIBUTION'),
  2, 'dua movement DISTRIBUTION');

-- stok kurang di salah satu baris → seluruh dokumen batal
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2"}';
select throws_like($$select public.create_distribution(gen_random_uuid(), (select clp from t), (select toko from bb), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 10),
                    jsonb_build_object('item_id', (select fg2 from t), 'unit_id', (select fg2_base from t), 'qty', 1000)))$$,
  'INSUFFICIENT_STOCK%', 'satu baris kurang stok → ditolak');
reset role;
select is(pg_temp.qty((select fg from t), (select clp from t)), (select fg_clp from b) + 2000 - 2 * (select dus from t), 'baris lain tidak ikut terpotong (atomik)');

-- konsumsi internal (rawatan ayam)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2"}';
select lives_ok($$select public.create_distribution('66666666-0000-0000-0000-000000000002', (select clp from t), (select internal from t), (select today from t), 'rawatan ayam',
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 50)))$$,
  'konsumsi internal dicatat sebagai distribusi');
reset role;

-- ---------- ADMIN_GUDANG Gudang Penjualan (Q21) ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c4"}';
select lives_ok($$select public.create_distribution('66666666-0000-0000-0000-000000000003', (select gpj from t), (select toko from bb), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_dus from t), 'qty', 1)))$$,
  'admin gudang distribusi dari gudang penjualan');
select is((select count(*)::int from public.distributions where location_id = (select clp from t)), 0, 'admin gudang penjualan tidak melihat distribusi pabrik');
select is((select count(*)::int from public.distribution_items di join public.distributions d on d.id = di.distribution_id
            where d.idempotency_key = '66666666-0000-0000-0000-000000000003'), 1, 'admin gudang melihat baris distribusinya');
select throws_like($$select public.void_transaction('distribution', (select id from public.distributions where idempotency_key = '66666666-0000-0000-0000-000000000003'), 'salah')$$,
  'FORBIDDEN%', 'admin gudang tidak boleh void');
reset role;
select is(pg_temp.qty((select fg from t), (select gpj from t)), (select fg_gpj from b) + 500 - (select dus from t), 'stok gudang penjualan berkurang 1 dus');

-- ---------- void ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2"}';
select throws_like($$select public.void_transaction('distribution', (select id from public.distributions where idempotency_key = '66666666-0000-0000-0000-000000000003'), 'bukan pabrik saya')$$,
  'FORBIDDEN%', 'owner pabrik tidak void distribusi gudang penjualan');
select lives_ok($$select public.void_transaction('distribution', (select id from public.distributions where idempotency_key = '66666666-0000-0000-0000-000000000001'), 'salah buyer')$$,
  'owner pabrik void distribusi pabriknya');
select is((public.void_transaction('distribution', (select id from public.distributions where idempotency_key = '66666666-0000-0000-0000-000000000001'), 'lagi') ->> 'replayed'),
  'true', 'void kedua → replayed');
reset role;
select is(pg_temp.qty((select fg from t), (select clp from t)), (select fg_clp from b) + 2000 - 50, 'void mengembalikan FG-006 ke pabrik');
select is(pg_temp.qty((select fg2 from t), (select clp from t)), (select fg2_clp from b) + 100, 'void mengembalikan FG-007 ke pabrik');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1"}';
select lives_ok($$select public.void_transaction('distribution', (select id from public.distributions where idempotency_key = '66666666-0000-0000-0000-000000000003'), 'uji super owner')$$,
  'super owner void distribusi gudang penjualan');
select is((select count(*)::int from public.distributions where created_by in ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4')),
  3, 'super owner melihat semua distribusi');
reset role;
select is(pg_temp.qty((select fg from t), (select gpj from t)), (select fg_gpj from b) + 500, 'void mengembalikan stok gudang penjualan');

select is(
  (select count(*)::int from public.stocks s
    where s.location_id in ((select clp from t), (select gpj from t))
      and s.quantity <> (select coalesce(sum(quantity_delta), 0) from public.stock_movements m
                          where m.item_id = s.item_id and m.location_id = s.location_id)),
  0, 'saldo = ledger di pabrik & gudang penjualan');

select * from finish();
rollback;
