# Runbook: restore backup database

Backup harian dibuat oleh workflow GitHub Actions `Database backup` (`.github/workflows/db-backup.yml`) dan disimpan 30 hari sebagai artifact terenkripsi.

## 1. Unduh dan dekripsi

1. GitHub → repo → **Actions** → **Database backup** → pilih run → unduh artifact `sasana-db-<tanggal>`.
2. Ekstrak zip artifact, lalu dekripsi (passphrase = secret `BACKUP_PASSPHRASE`):

```bash
gpg -d sasana-db-20261112-0200.tar.gz.gpg > sasana-db.tar.gz
tar -xzf sasana-db.tar.gz   # → roles.sql, schema.sql, data.sql
```

## 2. Restore ke project Supabase (kosong/baru)

Gunakan connection string **Session pooler** project tujuan. Jangan restore ke project produksi yang masih berisi data tanpa persetujuan owner.

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "<SESSION_POOLER_CONNECTION_STRING>"
```

`session_replication_role = replica` menonaktifkan trigger (termasuk audit) selama impor data supaya audit log tidak terduplikasi.

## 3. Verifikasi

- Login dengan akun SUPER_OWNER.
- Bandingkan jumlah baris tabel utama dengan project lama (`select count(*) from public.profiles;` dst.).
