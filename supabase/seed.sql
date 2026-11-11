-- Seed data lokal (supabase db reset). Tidak berisi user/password.
-- Lokasi awal sesuai master prompt §4. Gudang Penjualan ditambah lewat
-- master data (Phase 2) setelah nama & alamatnya dikonfirmasi.
insert into public.locations (code, name, type, is_inbound_hub) values
  ('GDG-KMB', 'Gudang Rumah (Kembaran)', 'WAREHOUSE', true),
  ('PBR-CLP', 'Pabrik Cilacap',          'FACTORY',   false),
  ('PBR-KMJ', 'Pabrik Kemranjen',        'FACTORY',   false)
on conflict (code) do nothing;
