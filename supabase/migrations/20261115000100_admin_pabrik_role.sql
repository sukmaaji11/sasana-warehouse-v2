-- =====================================================================
-- PHASE 5a — ROLE BARU ADMIN_PABRIK (keputusan Q10)
-- Dipisah dari migration produksi: nilai enum baru tidak boleh dipakai
-- di transaksi yang sama dengan ALTER TYPE ... ADD VALUE.
-- =====================================================================
alter type public.user_role add value if not exists 'ADMIN_PABRIK' after 'OWNER_PABRIK';
