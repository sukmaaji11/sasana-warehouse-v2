-- Phase 1: RLS & helper otorisasi untuk profiles, locations, user_locations, audit_logs.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- ---------- fixtures (sebagai postgres, bypass RLS) ----------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'tst.owner@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'tst.admin@users.sasana.internal',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'tst.pabrik@users.sasana.internal', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'tst.mati@users.sasana.internal',   'authenticated', 'authenticated');

insert into public.locations (id, code, name, type) values
  ('00000000-0000-0000-0000-0000000000b1', 'T-GDG', 'Test Gudang', 'WAREHOUSE'),
  ('00000000-0000-0000-0000-0000000000b2', 'T-PBR', 'Test Pabrik', 'FACTORY');

insert into public.profiles (id, username, full_name, role, is_active) values
  ('00000000-0000-0000-0000-0000000000a1', 'tst.owner',  'Owner',  'SUPER_OWNER',  true),
  ('00000000-0000-0000-0000-0000000000a2', 'tst.admin',  'Admin',  'ADMIN_GUDANG', true),
  ('00000000-0000-0000-0000-0000000000a3', 'tst.pabrik', 'Pabrik', 'OWNER_PABRIK', true),
  ('00000000-0000-0000-0000-0000000000a4', 'tst.mati',   'Mati',   'ADMIN_GUDANG', false);

insert into public.user_locations (user_id, location_id) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000b1');

-- ---------- constraints ----------
select throws_ok(
  $$insert into public.locations (code, name, type, is_inbound_hub) values ('T-HUB1','Hub 1','WAREHOUSE',true), ('T-HUB2','Hub 2','WAREHOUSE',true)$$,
  '23505', null, 'hanya satu inbound hub aktif');
select throws_ok(
  $$insert into public.locations (code, name, type) values ('bad code','X','WAREHOUSE')$$,
  '23514', null, 'kode lokasi harus huruf besar/angka/strip');
select is((select count(*)::int from public.audit_logs where table_name = 'locations' and new_data ->> 'code' in ('T-GDG', 'T-PBR')), 2,
  'insert lokasi tercatat di audit_logs');

-- ---------- anon ----------
set local role anon;
select throws_ok($$select * from public.locations$$, '42501', null, 'anon tidak bisa membaca locations');
select throws_ok($$select public.get_my_context()$$, '42501', null, 'anon tidak bisa memanggil get_my_context');
reset role;

-- ---------- ADMIN_GUDANG ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2"}';
select is((select count(*)::int from public.profiles where role <> 'DRIVER'), 1, 'admin hanya melihat profil sendiri');
select is((select count(*)::int from public.user_locations), 1, 'admin hanya melihat assignment sendiri');
select ok((select count(*) from public.locations) >= 2, 'user aktif melihat master lokasi');
select is((select count(*)::int from public.audit_logs), 0, 'admin tidak melihat audit log');
select ok(app.has_location('00000000-0000-0000-0000-0000000000b1'), 'admin punya akses gudang yang di-assign');
select ok(not app.has_location('00000000-0000-0000-0000-0000000000b2'), 'admin tidak punya akses pabrik');
select throws_ok(
  $$insert into public.locations (code, name, type) values ('T-X','X','FACTORY')$$,
  '42501', null, 'admin tidak bisa membuat lokasi');
select throws_ok(
  $$update public.profiles set role = 'SUPER_OWNER' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501', null, 'user tidak bisa menaikkan role sendiri');
select is((public.get_my_context() ->> 'role'), 'ADMIN_GUDANG', 'get_my_context mengembalikan role');
select is(jsonb_array_length(public.get_my_context() -> 'locations'), 1, 'get_my_context hanya lokasi yang di-assign');
reset role;

-- ---------- user nonaktif ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4"}';
select is((select count(*)::int from public.locations), 0, 'user nonaktif tidak melihat lokasi');
select ok(not app.has_location('00000000-0000-0000-0000-0000000000b1'), 'user nonaktif kehilangan akses lokasi');
select is((public.get_my_context() ->> 'is_active')::boolean, false, 'get_my_context menandai akun nonaktif');
reset role;

-- ---------- SUPER_OWNER ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
select is((select count(*)::int from public.profiles where id::text like '00000000-0000-0000-0000-0000000000a%'), 4, 'super owner melihat semua profil');
select lives_ok(
  $$insert into public.locations (code, name, type) values ('T-NEW','Lokasi Baru','SALES_WAREHOUSE')$$,
  'super owner bisa membuat lokasi');
reset role;

select * from finish();
rollback;
