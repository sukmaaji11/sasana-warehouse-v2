-- Phase 2: master data — integritas, RLS, dan RPC admin_update_user.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- ---------- fixtures ----------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'tst.so@users.sasana.internal',     'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'tst.ag@users.sasana.internal',     'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'tst.op@users.sasana.internal',     'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'tst.drv@users.sasana.internal',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'tst.drvoff@users.sasana.internal', 'authenticated', 'authenticated');
insert into public.profiles (id, username, full_name, role, is_active) values
  ('00000000-0000-0000-0000-0000000000a1', 'sowner', 'SO',      'SUPER_OWNER',  true),
  ('00000000-0000-0000-0000-0000000000a2', 'agudang', 'AG',      'ADMIN_GUDANG', true),
  ('00000000-0000-0000-0000-0000000000a3', 'opabrik', 'OP',      'OWNER_PABRIK', true),
  ('00000000-0000-0000-0000-0000000000a4', 'drv',    'Driver',  'DRIVER',       true),
  ('00000000-0000-0000-0000-0000000000a5', 'drvoff', 'Off',     'DRIVER',       false);

insert into public.items (id, sku, name, type, base_unit) values
  ('00000000-0000-0000-0000-0000000000c1', 'T-PKG', 'Test Sachet', 'PACKAGING', 'sachet'),
  ('00000000-0000-0000-0000-0000000000c2', 'T-FG',  'Test Produk', 'FINISHED_GOOD', 'sachet'),
  ('00000000-0000-0000-0000-0000000000c3', 'T-FG2', 'Test Produk 2', 'FINISHED_GOOD', 'sachet');

-- ---------- integritas item & satuan ----------
select is(
  (select count(*)::int from public.item_units where item_id = '00000000-0000-0000-0000-0000000000c1' and is_base and factor = 1 and unit_name = 'sachet'),
  1, 'base unit dibuat otomatis saat item dibuat');

update public.items set base_unit = 'pcs' where id = '00000000-0000-0000-0000-0000000000c1';
select is(
  (select unit_name from public.item_units where item_id = '00000000-0000-0000-0000-0000000000c1' and is_base),
  'pcs', 'base unit mengikuti perubahan items.base_unit');

select throws_like(
  $$update public.item_units set factor = 5 where item_id = '00000000-0000-0000-0000-0000000000c1' and is_base$$,
  'BASE_UNIT_LOCKED%', 'faktor base unit tidak bisa diubah');

select throws_ok(
  $$insert into public.item_units (item_id, unit_name, factor) values ('00000000-0000-0000-0000-0000000000c2', 'dus', 0)$$,
  '23514', null, 'faktor satuan harus > 0');

select throws_ok(
  $$insert into public.items (sku, name, type, base_unit) values ('T-DUP', 'test produk', 'FINISHED_GOOD', 'sachet')$$,
  '23505', null, 'nama item unik (tidak case-sensitive)');

-- ---------- product_packagings ----------
select throws_like(
  $$insert into public.product_packagings (finished_item_id, packaging_item_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3')$$,
  'INVALID_ITEM_TYPE%', 'packaging harus bertipe PACKAGING');
select throws_like(
  $$insert into public.product_packagings (finished_item_id, packaging_item_id) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1')$$,
  '%', 'produk dan packaging tidak boleh item yang sama');
select lives_ok(
  $$insert into public.product_packagings (finished_item_id, packaging_item_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1')$$,
  'mapping FG → packaging valid');
select throws_like(
  $$update public.items set type = 'PACKAGING' where id = '00000000-0000-0000-0000-0000000000c2'$$,
  'ITEM_TYPE_LOCKED%', 'tipe item terkunci setelah dipakai di mapping');

-- ---------- data awal ----------
select is((select count(*)::int from public.items where sku like 'PKG-%'), 15, '15 packaging awal');
select is((select count(*)::int from public.product_packagings pp join public.items i on i.id = pp.finished_item_id where i.sku like 'FG-%'), 15, '15 produk jadi punya packaging utama');
select is(
  (select u.factor from public.item_units u join public.items i on i.id = u.item_id where i.sku = 'FG-001' and u.unit_name = 'dus'),
  160, 'Dragon SN: 1 dus = 160 sachet');
select is((select type::text from public.locations where code = 'GPJ-KMB'), 'SALES_WAREHOUSE', 'Gudang Penjualan Kembaran ada');

-- ---------- ADMIN_GUDANG ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2"}';
select lives_ok($$insert into public.vendors (name) values ('Vendor Sachet Jaya')$$, 'admin gudang bisa menambah vendor');
select is((select created_by from public.vendors where name = 'Vendor Sachet Jaya'), '00000000-0000-0000-0000-0000000000a2'::uuid, 'created_by terisi otomatis');
select throws_ok($$insert into public.vendors (name) values ('vendor sachet jaya ')$$, '23505', null, 'vendor duplikat ditolak');
select lives_ok($$insert into public.buyers (name) values ('Toko Makmur')$$, 'admin gudang bisa menambah buyer');
select throws_ok($$delete from public.vendors$$, '42501', null, 'vendor tidak bisa dihapus (soft delete saja)');
select throws_ok(
  $$insert into public.items (sku, name, type, base_unit) values ('T-X', 'X', 'PACKAGING', 'sachet')$$,
  '42501', null, 'admin gudang tidak bisa menambah item');
select is((select count(*)::int from public.profiles where id in ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a1')), 1, 'admin gudang melihat driver aktif saja (bukan driver nonaktif / user lain)');
select throws_like(
  $$select public.admin_update_user('00000000-0000-0000-0000-0000000000a4', 'X', 'DRIVER', true, '{}')$$,
  'FORBIDDEN%', 'admin gudang tidak bisa mengubah user');
reset role;

-- ---------- DRIVER ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4"}';
select ok((select count(*) from public.items) > 0, 'driver bisa membaca katalog item');
select is((select count(*)::int from public.vendors), 0, 'driver tidak melihat vendor');
select is((select count(*)::int from public.buyers), 0, 'driver tidak melihat buyer');
reset role;

-- ---------- SUPER_OWNER: admin_update_user ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
select lives_ok(
  $$select public.admin_update_user('00000000-0000-0000-0000-0000000000a2', 'Admin Baru', 'ADMIN_GUDANG', true,
      array[(select id from public.locations where code = 'GDG-KMB'), (select id from public.locations where code = 'GPJ-KMB')])$$,
  'super owner mengubah user & lokasi');
select is(
  (select count(*)::int from public.user_locations where user_id = '00000000-0000-0000-0000-0000000000a2'),
  2, 'lokasi user diganti sesuai input');
select throws_like(
  $$select public.admin_update_user('00000000-0000-0000-0000-0000000000a1', 'SO', 'ADMIN_GUDANG', true, '{}')$$,
  'SELF_LOCKOUT%', 'super owner tidak bisa menurunkan role sendiri');
reset role;

select ok(
  (select count(*) from public.audit_logs where table_name = 'profiles' and record_id = '00000000-0000-0000-0000-0000000000a2' and action = 'PROFILES_UPDATE') = 1,
  'perubahan user tercatat di audit log');

select * from finish();
rollback;
