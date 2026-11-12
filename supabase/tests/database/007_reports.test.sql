-- Phase 7: laporan mutasi stok & dashboard — angka benar dan dibatasi RLS.
-- Memakai pabrik khusus test (TST7) agar saldo awal pasti 0.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- ---------- fixtures ----------
insert into public.locations (id, code, name, type) values
  ('77777777-0000-0000-0000-0000000000f1', 'TST7-PBR', 'Pabrik Uji 7', 'FACTORY');
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'tst7.so@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', 'tst7.op@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d3', 'tst7.ap@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d4', 'tst7.op2@users.sasana.internal', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d5', 'tst7.drv@users.sasana.internal', 'authenticated', 'authenticated');
insert into public.profiles (id, username, full_name, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'tst7.so',  'SO',      'SUPER_OWNER'),
  ('00000000-0000-0000-0000-0000000000d2', 'tst7.op',  'OP Uji',  'OWNER_PABRIK'),
  ('00000000-0000-0000-0000-0000000000d3', 'tst7.ap',  'AP Uji',  'ADMIN_PABRIK'),
  ('00000000-0000-0000-0000-0000000000d4', 'tst7.op2', 'OP KMJ',  'OWNER_PABRIK'),
  ('00000000-0000-0000-0000-0000000000d5', 'tst7.drv', 'Driver',  'DRIVER');
insert into public.user_locations (user_id, location_id) values
  ('00000000-0000-0000-0000-0000000000d2', '77777777-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000d3', '77777777-0000-0000-0000-0000000000f1');
insert into public.user_locations (user_id, location_id)
select '00000000-0000-0000-0000-0000000000d4'::uuid, id from public.locations where code = 'PBR-KMJ';
insert into public.product_locations (finished_item_id, location_id)
select id, '77777777-0000-0000-0000-0000000000f1' from public.items where sku = 'FG-006';

create temp table t as
select
  '77777777-0000-0000-0000-0000000000f1'::uuid as loc,
  (select id from public.items where sku = 'PKG-006') as pkg,
  (select id from public.items where sku = 'FG-006') as fg,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-006' and u.is_base) as fg_base,
  (select id from public.buyers where name = 'Konsumsi internal – Rawatan ayam') as buyer,
  (now() at time zone 'Asia/Jakarta')::date as today;
grant select on t to authenticated;

-- packaging 1.000 → produksi 300 good + 20 reject → distribusi 100
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1"}';
select lives_ok($$select public.create_stock_adjustment(gen_random_uuid(), 'ADJUSTMENT', (select loc from t), 'fixture', (select today from t),
  jsonb_build_array(jsonb_build_object('item_id', (select pkg from t), 'physical_qty', 1000)))$$, 'fixture packaging');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2"}';
select lives_ok($$select public.create_production(gen_random_uuid(), (select loc from t), (select fg from t), (select fg_base from t), 300, 20, (select today from t), null)$$, 'produksi');
select lives_ok($$select public.create_distribution(gen_random_uuid(), (select loc from t), (select buyer from t), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 100)))$$, 'distribusi');

-- ---------- mutasi stok ----------
create temp table r as select * from public.report_stock_mutation((select today from t), (select today from t), (select loc from t));
select is((select count(*)::int from r), 2, 'dua baris (packaging & produk)');
select is((select row(opening, adjusted, consumed, closing)::text from r where item_id = (select pkg from t)), '(0,1000,320,680)',
  'packaging: awal 0, penyesuaian +1.000, terpakai 320, akhir 680');
select is((select row(opening, produced, distributed, closing)::text from r where item_id = (select fg from t)), '(0,300,100,200)',
  'produk: diproduksi 300, distribusi 100, akhir 200');
select is((select count(*)::int from r where opening + inbound + received + produced - consumed - shipped - distributed + adjusted <> closing), 0,
  'awal + masuk − keluar = akhir');
select is((select count(*)::int from public.report_stock_mutation((select today from t) - 30, (select today from t) - 1, (select loc from t))), 0,
  'periode sebelum transaksi: kosong');
select is((select row(opening, closing)::text from public.report_stock_mutation((select today from t) + 1, (select today from t) + 1, (select loc from t))
            where item_id = (select pkg from t)), '(680,680)', 'periode sesudahnya: saldo awal = saldo akhir sebelumnya');
select throws_like($$select * from public.report_stock_mutation((select today from t), (select today from t) - 1)$$, 'VALIDATION%', 'periode terbalik ditolak');
select throws_like($$select * from public.report_stock_mutation((select today from t) - 400, (select today from t))$$, 'VALIDATION%1 tahun%', 'periode > 1 tahun ditolak');

-- ---------- dashboard Owner Pabrik ----------
create temp table d as select public.get_dashboard() as j;
select is(jsonb_array_length((select j from d) -> 'locations'), 1, 'owner pabrik: satu lokasi');
select is(((select j from d) -> 'locations' -> 0 ->> 'packaging_qty')::int, 680, 'stok packaging 680');
select is(((select j from d) -> 'locations' -> 0 -> 'production_today' ->> 'good')::int, 300, 'produksi hari ini 300');
select is(((select j from d) -> 'locations' -> 0 -> 'production_today' ->> 'reject')::int, 20, 'reject hari ini 20');
select is(((select j from d) -> 'locations' -> 0 ->> 'distribution_today')::int, 100, 'distribusi hari ini 100');
select is(((select j from d) -> 'locations' -> 0 ->> 'low_count')::int, 0, 'belum ada stok menipis');

-- distribusi 150 lagi → produk tinggal 50 < minimum 100 → menipis
select lives_ok($$select public.create_distribution(gen_random_uuid(), (select loc from t), (select buyer from t), (select today from t), null,
  jsonb_build_array(jsonb_build_object('item_id', (select fg from t), 'unit_id', (select fg_base from t), 'qty', 150)))$$, 'distribusi kedua');
select is((public.get_dashboard() -> 'locations' -> 0 ->> 'low_count')::int, 1, 'produk menipis terhitung');
select ok(exists (select 1 from jsonb_array_elements(public.get_dashboard() -> 'low_stock') x where x ->> 'location_name' = 'Pabrik Uji 7'),
  'muncul di daftar stok menipis');

-- void produksi: pembalikan dihitung di kolom asalnya, bukan "penyesuaian"
select lives_ok($$select public.create_production('77777777-0000-0000-0000-0000000000a1', (select loc from t), (select fg from t), (select fg_base from t), 50, 5, (select today from t), null)$$, 'produksi salah');
select lives_ok($$select public.void_transaction('production', (select id from public.productions where idempotency_key = '77777777-0000-0000-0000-0000000000a1'), 'salah input')$$, 'void produksi');
select is((select row(produced, adjusted)::text from public.report_stock_mutation((select today from t), (select today from t), (select loc from t))
            where item_id = (select fg from t)), '(300,0)', 'void produksi mengurangi kolom hasil produksi');
select is((select row(consumed, adjusted)::text from public.report_stock_mutation((select today from t), (select today from t), (select loc from t))
            where item_id = (select pkg from t)), '(320,1000)', 'void produksi mengurangi kolom pakai produksi');
reset role;

-- ---------- RLS ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4"}';
select is((select count(*)::int from public.report_stock_mutation((select today from t), (select today from t), (select loc from t))), 0,
  'owner pabrik lain tidak melihat mutasi pabrik uji');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3"}';
select is((public.get_dashboard() -> 'locations' -> 0 ->> 'distribution_today')::int, 0,
  'admin pabrik: angka distribusi tidak terlihat (bukan wewenangnya)');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d5"}';
select is(jsonb_array_length(public.get_dashboard() -> 'locations'), 0, 'driver: tanpa ringkasan lokasi');
reset role;

select * from finish();
rollback;
