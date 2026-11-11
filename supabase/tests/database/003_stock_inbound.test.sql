-- Phase 3: stok, inbound, stok awal/penyesuaian, void, produk per pabrik.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- ---------- fixtures ----------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'tst3.so@users.sasana.internal', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'tst3.ag@users.sasana.internal', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'tst3.op@users.sasana.internal', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'tst3.ag2@users.sasana.internal', 'authenticated', 'authenticated');
insert into public.profiles (id, username, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'tst3.so',  'SO',  'SUPER_OWNER'),
  ('00000000-0000-0000-0000-0000000000a2', 'tst3.ag',  'AG',  'ADMIN_GUDANG'),
  ('00000000-0000-0000-0000-0000000000a3', 'tst3.op',  'OP',  'OWNER_PABRIK'),
  ('00000000-0000-0000-0000-0000000000a4', 'tst3.ag2', 'AG2', 'ADMIN_GUDANG');
insert into public.user_locations (user_id, location_id)
select '00000000-0000-0000-0000-0000000000a2'::uuid, id from public.locations where code = 'GDG-KMB'
union all
select '00000000-0000-0000-0000-0000000000a3'::uuid, id from public.locations where code = 'PBR-CLP'
union all
select '00000000-0000-0000-0000-0000000000a4'::uuid, id from public.locations where code = 'GPJ-KMB';
insert into public.vendors (id, name) values ('00000000-0000-0000-0000-0000000000f1', 'TST Vendor');

-- helper: id barang & satuan dasar
create temp table t as
select
  (select id from public.items where sku = 'PKG-001') as pkg1,
  (select id from public.items where sku = 'PKG-002') as pkg2,
  (select id from public.items where sku = 'FG-001') as fg1,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'PKG-001' and u.is_base) as pkg1_unit,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'PKG-002' and u.is_base) as pkg2_unit,
  (select u.id from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-001' and u.is_base) as fg1_unit,
  (select id from public.locations where code = 'GDG-KMB') as hub,
  (select id from public.locations where code = 'PBR-CLP') as clp,
  coalesce((select s.quantity from public.stocks s join public.items i on i.id = s.item_id join public.locations l on l.id = s.location_id
             where i.sku = 'PKG-001' and l.code = 'GDG-KMB'), 0) as base_pkg1;
grant select on t to authenticated;

-- ---------- Phase 2b: produk per pabrik & min stok ----------
select is((select count(*)::int from public.product_locations pl join public.locations l on l.id = pl.location_id where l.code = 'PBR-KMJ'), 6, 'Kemranjen: 6 produk');
select is((select count(*)::int from public.product_locations pl join public.locations l on l.id = pl.location_id where l.code = 'PBR-CLP'), 9, 'Cilacap: 9 produk');
select is((select min_stock from public.items where sku = 'PKG-001'), 100::bigint, 'minimum stok default 100');
select throws_like(
  $$insert into public.product_locations (finished_item_id, location_id) select (select pkg1 from t), (select clp from t)$$,
  'INVALID_ITEM_TYPE%', 'packaging tidak bisa didaftarkan sebagai produk pabrik');

-- ---------- ADMIN_GUDANG: inbound ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2"}';

select lives_ok(format(
  $$select public.create_inbound('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', (now() at time zone 'Asia/Jakarta')::date, 'tes',
     jsonb_build_array(jsonb_build_object('item_id', %L, 'unit_id', %L, 'qty', 1000),
                       jsonb_build_object('item_id', %L, 'unit_id', %L, 'qty', 500)))$$,
  (select pkg1 from t), (select pkg1_unit from t), (select pkg2 from t), (select pkg2_unit from t)),
  'admin gudang membuat inbound');
select is((select quantity from public.stocks where item_id = (select pkg1 from t) and location_id = (select hub from t)), (select base_pkg1 from t) + 1000, 'stok hub bertambah 1000');
select is((select count(*)::int from public.stock_movements m join public.inbound_transactions i on i.id = m.ref_id where i.idempotency_key = '11111111-0000-0000-0000-000000000001'), 2, '2 movement INBOUND tercatat');
select matches((select doc_no from public.inbound_transactions where idempotency_key = '11111111-0000-0000-0000-000000000001'), '^INB-\d{6}-\d{4}$', 'nomor dokumen INB-YYYYMM-NNNN');

select is(
  (public.create_inbound('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', (now() at time zone 'Asia/Jakarta')::date, 'tes',
     jsonb_build_array(jsonb_build_object('item_id', (select pkg1 from t), 'unit_id', (select pkg1_unit from t), 'qty', 1000))) ->> 'replayed'),
  'true', 'retry dengan key sama → replayed, tidak menggandakan');
select is((select quantity from public.stocks where item_id = (select pkg1 from t) and location_id = (select hub from t)), (select base_pkg1 from t) + 1000, 'stok tidak bertambah lagi setelah retry');

select throws_like(format(
  $$select public.create_inbound(gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', (now() at time zone 'Asia/Jakarta')::date, null,
     jsonb_build_array(jsonb_build_object('item_id', %L, 'unit_id', %L, 'qty', 5)))$$, (select fg1 from t), (select fg1_unit from t)),
  'VALIDATION%', 'inbound produk jadi ditolak (hanya packaging)');
select throws_like(format(
  $$select public.create_inbound(gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', (now() at time zone 'Asia/Jakarta')::date - 8, null,
     jsonb_build_array(jsonb_build_object('item_id', %L, 'unit_id', %L, 'qty', 5)))$$, (select pkg1 from t), (select pkg1_unit from t)),
  'VALIDATION: tanggal transaksi maksimal 7 hari%', 'tanggal > 7 hari ke belakang ditolak');
select lives_ok(format(
  $$select public.create_inbound(gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', (now() at time zone 'Asia/Jakarta')::date - 7, null,
     jsonb_build_array(jsonb_build_object('item_id', %L, 'unit_id', %L, 'qty', 5)))$$, (select pkg1 from t), (select pkg1_unit from t)),
  'tanggal tepat 7 hari ke belakang diterima');
select throws_like(format(
  $$select public.create_inbound(gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', (now() at time zone 'Asia/Jakarta')::date + 1, null,
     jsonb_build_array(jsonb_build_object('item_id', %L, 'unit_id', %L, 'qty', 5)))$$, (select pkg1 from t), (select pkg1_unit from t)),
  'VALIDATION: tanggal transaksi tidak boleh di masa depan', 'tanggal masa depan ditolak');
select throws_like(format(
  $$select public.create_inbound(gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', (now() at time zone 'Asia/Jakarta')::date, null,
     jsonb_build_array(jsonb_build_object('item_id', %L, 'unit_id', %L, 'qty', 0)))$$, (select pkg1 from t), (select pkg1_unit from t)),
  'VALIDATION%', 'qty 0 ditolak');
select throws_like(format(
  $$select public.create_inbound(gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', (now() at time zone 'Asia/Jakarta')::date, null,
     jsonb_build_array(jsonb_build_object('item_id', %1$L, 'unit_id', %2$L, 'qty', 1), jsonb_build_object('item_id', %1$L, 'unit_id', %2$L, 'qty', 2)))$$,
  (select pkg1 from t), (select pkg1_unit from t)),
  'VALIDATION%', 'barang duplikat dalam satu inbound ditolak');
select throws_ok($$insert into public.stocks (item_id, location_id, quantity) select pkg1, hub, 999 from t$$, '42501', null, 'client tidak bisa menulis tabel stocks');
select throws_ok($$update public.stocks set quantity = 1$$, '42501', null, 'client tidak bisa mengubah stocks');
select throws_ok($$insert into public.stock_movements (item_id) select pkg1 from t$$, '42501', null, 'client tidak bisa menulis stock_movements');
select throws_like(
  $$select public.create_stock_adjustment(gen_random_uuid(), 'ADJUSTMENT', (select hub from t), 'x', (now() at time zone 'Asia/Jakarta')::date, '[]')$$,
  'FORBIDDEN%', 'admin gudang tidak bisa membuat penyesuaian');
select throws_like(
  $$select public.void_transaction('inbound', (select id from public.inbound_transactions where idempotency_key = '11111111-0000-0000-0000-000000000001'), 'x')$$,
  'FORBIDDEN%', 'admin gudang tidak bisa void');
reset role;

-- ---------- ADMIN_GUDANG tanpa akses hub ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4"}';
select throws_like(format(
  $$select public.create_inbound(gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', (now() at time zone 'Asia/Jakarta')::date, null,
     jsonb_build_array(jsonb_build_object('item_id', %L, 'unit_id', %L, 'qty', 5)))$$, (select pkg1 from t), (select pkg1_unit from t)),
  'FORBIDDEN_LOCATION%', 'admin gudang yang tidak ditugaskan ke gudang pusat ditolak');
select is((select count(*)::int from public.stocks where location_id = (select hub from t)), 0, 'admin lokasi lain tidak melihat stok gudang pusat');
reset role;

-- ---------- OWNER_PABRIK ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3"}';
select throws_like(format(
  $$select public.create_inbound(gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', (now() at time zone 'Asia/Jakarta')::date, null,
     jsonb_build_array(jsonb_build_object('item_id', %L, 'unit_id', %L, 'qty', 5)))$$, (select pkg1 from t), (select pkg1_unit from t)),
  'FORBIDDEN', 'owner pabrik tidak bisa inbound');
select is((select count(*)::int from public.inbound_transactions), 0, 'owner pabrik tidak melihat inbound');
reset role;

-- ---------- SUPER_OWNER: stok awal, penyesuaian, void ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1"}';

select lives_ok(
  $$select public.create_stock_adjustment('22222222-0000-0000-0000-000000000001', 'OPENING_BALANCE', (select clp from t), 'Cek fisik go-live', (now() at time zone 'Asia/Jakarta')::date,
     jsonb_build_array(jsonb_build_object('item_id', (select fg1 from t), 'physical_qty', 300)))$$,
  'stok awal produk jadi di Cilacap');
select is((select quantity from public.stocks where item_id = (select fg1 from t) and location_id = (select clp from t)), 300::bigint, 'stok awal = 300');
select throws_like(
  $$select public.create_stock_adjustment(gen_random_uuid(), 'OPENING_BALANCE', (select clp from t), 'lagi', (now() at time zone 'Asia/Jakarta')::date,
     jsonb_build_array(jsonb_build_object('item_id', (select fg1 from t), 'physical_qty', 10)))$$,
  'VALIDATION: stok awal%', 'stok awal kedua untuk barang+lokasi yang sama ditolak');
select lives_ok(
  $$select public.create_stock_adjustment('22222222-0000-0000-0000-000000000002', 'ADJUSTMENT', (select clp from t), 'Selisih opname', (now() at time zone 'Asia/Jakarta')::date,
     jsonb_build_array(jsonb_build_object('item_id', (select fg1 from t), 'physical_qty', 280)))$$,
  'penyesuaian stok opname');
select is((select delta from public.stock_adjustment_items i join public.stock_adjustments a on a.id = i.adjustment_id where a.idempotency_key = '22222222-0000-0000-0000-000000000002'), -20::bigint, 'selisih dihitung otomatis (-20)');
select is((select movement_type::text from public.stock_movements m join public.stock_adjustments a on a.id = m.ref_id where a.idempotency_key = '22222222-0000-0000-0000-000000000002'), 'ADJUSTMENT_OUT', 'movement ADJUSTMENT_OUT');

-- Void inbound: stok hub kembali
select lives_ok(
  $$select public.void_transaction('inbound', (select id from public.inbound_transactions where idempotency_key = '11111111-0000-0000-0000-000000000001'), 'Salah input')$$,
  'super owner void inbound');
select is((select quantity from public.stocks where item_id = (select pkg1 from t) and location_id = (select hub from t)), (select base_pkg1 from t) + 5, 'stok PKG-001 kembali (1000 dibalik, sisa inbound 5)');
select is(
  (public.void_transaction('inbound', (select id from public.inbound_transactions where idempotency_key = '11111111-0000-0000-0000-000000000001'), 'lagi') ->> 'replayed'),
  'true', 'void kedua kali → replayed tanpa efek');

-- Void yang membuat stok negatif ditolak: stok awal 300 → sudah dikurangi opname ke 280, kurangi lagi ke 0
select lives_ok(
  $$select public.create_stock_adjustment(gen_random_uuid(), 'ADJUSTMENT', (select clp from t), 'habis', (now() at time zone 'Asia/Jakarta')::date,
     jsonb_build_array(jsonb_build_object('item_id', (select fg1 from t), 'physical_qty', 0)))$$, 'penyesuaian ke 0');
select throws_like(
  $$select public.void_transaction('stock_adjustment', (select id from public.stock_adjustments where idempotency_key = '22222222-0000-0000-0000-000000000001'), 'x')$$,
  'INSUFFICIENT_STOCK%', 'void stok awal ditolak karena stok sudah terpakai');
reset role;

-- ---------- Rekonsiliasi: saldo = SUM(movement) ----------
select is(
  (select count(*)::int from public.stocks s
    where s.quantity <> coalesce((select sum(quantity_delta) from public.stock_movements m
                                   where m.item_id = s.item_id and m.location_id = s.location_id), 0)),
  0, 'saldo stok = jumlah seluruh movement (ledger konsisten)');

select * from finish();
rollback;
