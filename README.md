# Sasana Warehouse

Sistem gudang, produksi, dan distribusi jamu Sasana. Satu database Supabase dipakai oleh:

- **apps/mobile**: Android (Expo SDK 58, Expo Router). Platform utama operator lapangan dan driver.
- **apps/web**: dashboard admin (Next.js 16, Tailwind, shadcn/ui). Platform utama Super Owner, Admin Gudang, dan Owner Pabrik.

Dokumen desain: [docs/phase-0/PHASE-0-DISCOVERY.md](docs/phase-0/PHASE-0-DISCOVERY.md)

## Struktur

```text
apps/mobile               Android (Expo)
apps/web                  Web (Next.js)
packages/shared-constants Role, label, kode error → pesan Indonesia
packages/shared-validation Skema Zod (dipakai kedua app)
packages/shared-types     Tipe database (hasil supabase gen types) + tipe domain
packages/shared-api       Pemanggilan Supabase/RPC + query keys (dipakai kedua app)
supabase/migrations       Skema database, RLS, fungsi (sumber kebenaran business logic)
supabase/tests            Test pgTAP (RLS & RPC)
scripts/                  Script developer (bootstrap akun pertama)
.github/workflows         Backup database harian
```

## Prasyarat

- Node.js **≥ 22.13** (syarat Expo SDK 58)
- pnpm 10 (`npm install -g pnpm`)
- Docker Desktop (untuk Supabase lokal dan test database)
- Android: emulator Android Studio atau HP dengan Expo Go

## Setup

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local        # isi URL + publishable key
cp apps/mobile/.env.example apps/mobile/.env.local  # isi URL + publishable key
```

Hanya **publishable (anon) key** yang boleh masuk ke app. Service role key hanya untuk `/.env.local` (script developer) dan Edge Function.

### Database lokal

```bash
pnpm db:start     # jalankan Supabase lokal (Docker); menampilkan URL & key lokal
pnpm db:reset     # terapkan ulang migration + seed
pnpm db:test      # test pgTAP (RLS, RPC)
pnpm db:types     # generate packages/shared-types/src/database.types.ts
```

### Akun pertama (SUPER_OWNER)

Isi `/.env.local` (lihat `/.env.example`), lalu:

```bash
pnpm bootstrap:owner --username owner --name "Nama Owner"
```

## Menjalankan

```bash
pnpm web          # http://localhost:3000
pnpm mobile       # Expo dev server → tekan "a" untuk emulator Android atau scan QR di Expo Go
```

## Pemeriksaan

```bash
pnpm typecheck
pnpm lint
pnpm test         # unit test shared packages
pnpm db:test      # test database
```

## Aturan penting

- Semua perubahan stok **hanya** lewat fungsi RPC di database. Client tidak boleh menulis tabel stok.
- Online-first: transaksi gagal jelas saat offline; tidak ada antrean offline.
- Transaksi tidak pernah dihapus; koreksi lewat Void/Penyesuaian (Phase 3+).
- Android dan web memakai `shared-validation` + `shared-api` yang sama.
