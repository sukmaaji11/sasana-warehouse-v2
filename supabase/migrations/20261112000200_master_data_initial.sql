-- =====================================================================
-- PHASE 2 — DATA MASTER AWAL (sekali jalan, idempoten)
-- Sumber: seed.js sistem lama (Q19) + Gudang Penjualan Kembaran (Q20).
-- Hanya master data. TIDAK ada user dan TIDAK ada stok
-- (stok awal diinput dari cek fisik — Decision Log Q1).
-- Konversi (seed lama): renteng = isi sachet per renteng;
--   dus = jumlah renteng per dus (jika ada renteng), atau isi base unit per dus.
-- Packaging hanya punya base unit (Q6: inbound diinput per sachet/botol/karton).
-- =====================================================================

insert into public.locations (code, name, address, type, is_inbound_hub) values
  ('GDG-KMB', 'Gudang Rumah (Kembaran)',     null,        'WAREHOUSE',       true),
  ('PBR-CLP', 'Pabrik Cilacap',              null,        'FACTORY',         false),
  ('PBR-KMJ', 'Pabrik Kemranjen',            null,        'FACTORY',         false),
  ('GPJ-KMB', 'Gudang Penjualan Kembaran',   'Kembaran',  'SALES_WAREHOUSE', false)
on conflict (code) do nothing;

-- Packaging
insert into public.items (sku, name, type, base_unit) values
  ('PKG-001', 'Sachet Dragon SN',        'PACKAGING', 'sachet'),
  ('PKG-002', 'Sachet Herbal 35',        'PACKAGING', 'sachet'),
  ('PKG-003', 'Sachet Herbal 100',       'PACKAGING', 'sachet'),
  ('PKG-004', 'Sachet Bima',             'PACKAGING', 'sachet'),
  ('PKG-005', 'Sachet Monster',          'PACKAGING', 'sachet'),
  ('PKG-006', 'Sachet Super Rontox',     'PACKAGING', 'sachet'),
  ('PKG-007', 'Sachet Magic Blue',       'PACKAGING', 'sachet'),
  ('PKG-008', 'Sachet Magic Green',      'PACKAGING', 'sachet'),
  ('PKG-009', 'Sachet Dragon Merpati',   'PACKAGING', 'sachet'),
  ('PKG-010', 'Botol Dopping',           'PACKAGING', 'botol'),
  ('PKG-011', 'Karton Monster Grow',     'PACKAGING', 'karton'),
  ('PKG-012', 'Sachet Magic Blue Bird',  'PACKAGING', 'sachet'),
  ('PKG-013', 'Sachet Magic Green Bird', 'PACKAGING', 'sachet'),
  ('PKG-014', 'Sachet Turun Urat',       'PACKAGING', 'sachet'),
  ('PKG-015', 'Botol Salep SN',          'PACKAGING', 'botol')
on conflict (sku) do nothing;

-- Produk jadi + packaging utama + konversi
create temporary table _fg (
  sku text, name text, base_unit text, packaging_sku text, renteng int, dus int
);

insert into _fg values
  ('FG-001', 'Dragon SN',          'sachet', 'PKG-001', 10,   16),
  ('FG-002', 'Herbal SN 35 Gram',  'sachet', 'PKG-002', 10,   20),
  ('FG-003', 'Herbal SN 100 Gram', 'sachet', 'PKG-003', null, 50),
  ('FG-004', 'Bima Power',         'sachet', 'PKG-004', 10,   50),
  ('FG-005', 'Monster Pro',        'sachet', 'PKG-005', 10,   36),
  ('FG-006', 'Super Rontox',       'sachet', 'PKG-006', 20,   20),
  ('FG-007', 'Magic Blue',         'sachet', 'PKG-007', 10,   20),
  ('FG-008', 'Magic Green',        'sachet', 'PKG-008', 10,   20),
  ('FG-009', 'Dragon Merpati',     'sachet', 'PKG-009', 10,   36),
  ('FG-010', 'Dopping Dewa',       'botol',  'PKG-010', null, 10),
  ('FG-011', 'Monster Grow',       'karton', 'PKG-011', null, 10),
  ('FG-012', 'Magic Blue Bird',    'sachet', 'PKG-012', 10,   20),
  ('FG-013', 'Magic Green Bird',   'sachet', 'PKG-013', 10,   20),
  ('FG-014', 'Turun Urat',         'sachet', 'PKG-014', 10,   20),
  ('FG-015', 'Salep SN',           'botol',  'PKG-015', null, 10);

insert into public.items (sku, name, type, base_unit)
select sku, name, 'FINISHED_GOOD', base_unit from _fg
on conflict (sku) do nothing;

insert into public.product_packagings (finished_item_id, packaging_item_id)
select f.id, p.id
  from _fg
  join public.items f on f.sku = _fg.sku
  join public.items p on p.sku = _fg.packaging_sku
on conflict (finished_item_id) do nothing;

insert into public.item_units (item_id, unit_name, factor)
select i.id, 'renteng', _fg.renteng
  from _fg join public.items i on i.sku = _fg.sku
 where _fg.renteng is not null
on conflict (item_id, unit_name) do nothing;

insert into public.item_units (item_id, unit_name, factor)
select i.id, 'dus', coalesce(_fg.renteng, 1) * _fg.dus
  from _fg join public.items i on i.sku = _fg.sku
on conflict (item_id, unit_name) do nothing;

drop table _fg;
