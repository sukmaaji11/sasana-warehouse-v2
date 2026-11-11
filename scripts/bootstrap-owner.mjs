#!/usr/bin/env node
/**
 * Membuat akun SUPER_OWNER pertama (sekali saja, saat project baru).
 * Akun berikutnya dibuat dari menu Users di web (Phase 2).
 *
 * Dijalankan di laptop developer, BUKAN di app:
 *   pnpm bootstrap:owner --username owner --name "Nama Owner"
 *
 * Membaca dari .env.local di root (tidak di-commit):
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (secret key — jangan pernah ditaruh di app)
 * Password diminta lewat prompt agar tidak tersimpan di history terminal.
 */
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

const AUTH_EMAIL_DOMAIN = 'users.sasana.internal';
const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

const { values } = parseArgs({
  options: {
    username: { type: 'string' },
    name: { type: 'string' },
  },
});

const username = values.username?.trim().toLowerCase();
const fullName = values.name?.trim();
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

if (!url || !serviceKey) fail('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local (root).');
if (!username || !USERNAME_PATTERN.test(username)) {
  fail('--username wajib: 3–30 karakter, huruf kecil/angka/titik/garis bawah.');
}
if (!fullName) fail('--name wajib diisi.');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Password (min. 8 karakter, huruf + angka): ');
rl.close();
if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
  fail('Password minimal 8 karakter dan mengandung huruf serta angka.');
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { count, error: countError } = await admin
  .from('profiles')
  .select('id', { count: 'exact', head: true })
  .eq('role', 'SUPER_OWNER');
if (countError) fail(`Gagal membaca profiles: ${countError.message}. Sudahkah migration dijalankan?`);
if ((count ?? 0) > 0) fail('Sudah ada SUPER_OWNER. Buat user berikutnya dari menu Users di web.');

const email = `${username}@${AUTH_EMAIL_DOMAIN}`;
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createError) fail(`Gagal membuat user auth: ${createError.message}`);

const userId = created.user.id;
const { error: profileError } = await admin.from('profiles').insert({
  id: userId,
  username,
  full_name: fullName,
  role: 'SUPER_OWNER',
});
if (profileError) {
  await admin.auth.admin.deleteUser(userId); // rollback agar tidak ada user tanpa profil
  fail(`Gagal membuat profil: ${profileError.message}`);
}

console.log(`✔ SUPER_OWNER dibuat: username "${username}" (${fullName}).`);
