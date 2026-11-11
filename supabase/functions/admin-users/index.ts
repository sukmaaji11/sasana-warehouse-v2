// Edge Function: admin-users
// Membuat akun dan mereset password. Hanya untuk SUPER_OWNER aktif.
// Service role key HANYA ada di environment Edge Function (tidak pernah di client).
// Perubahan nama/role/status/lokasi memakai RPC public.admin_update_user.
import { createClient } from 'npm:@supabase/supabase-js@2';

const AUTH_EMAIL_DOMAIN = 'users.sasana.internal';
const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
const ROLES = ['SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'DRIVER'] as const;
const UUID = /^[0-9a-f-]{36}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
const fail = (status: number, code: string, message: string) => reply(status, { error: { code, message } });

function validPassword(p: unknown): p is string {
  return typeof p === 'string' && p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Gunakan POST');

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // 1. Pastikan pemanggil adalah SUPER_OWNER aktif (dicek ke database, bukan dari body).
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: me, error: meError } = await caller.rpc('get_my_context');
  if (meError || !me) return fail(401, 'NOT_AUTHENTICATED', 'Sesi berakhir. Silakan login kembali.');
  if (me.role !== 'SUPER_OWNER' || !me.is_active) {
    return fail(403, 'FORBIDDEN', 'Hanya Super Owner yang bisa mengelola user.');
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'VALIDATION', 'Body harus JSON');
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 2a. Buat user
  if (body.action === 'create') {
    const username = String(body.username ?? '').trim().toLowerCase();
    const fullName = String(body.full_name ?? '').trim();
    const role = body.role as (typeof ROLES)[number];
    const locationIds = Array.isArray(body.location_ids) ? body.location_ids : [];

    if (!USERNAME_PATTERN.test(username)) return fail(400, 'VALIDATION', 'Username tidak valid');
    if (!fullName) return fail(400, 'VALIDATION', 'Nama wajib diisi');
    if (!ROLES.includes(role)) return fail(400, 'VALIDATION', 'Role tidak valid');
    if (!validPassword(body.password)) {
      return fail(400, 'VALIDATION', 'Password minimal 8 karakter dan mengandung huruf serta angka');
    }
    if (!locationIds.every((id) => typeof id === 'string' && UUID.test(id))) {
      return fail(400, 'VALIDATION', 'Lokasi tidak valid');
    }

    const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
    if (existing) return fail(409, 'USERNAME_TAKEN', 'Username sudah dipakai');

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `${username}@${AUTH_EMAIL_DOMAIN}`,
      password: body.password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      const taken = /already|exists|registered/i.test(createError?.message ?? '');
      return fail(taken ? 409 : 500, taken ? 'USERNAME_TAKEN' : 'UNKNOWN', taken ? 'Username sudah dipakai' : 'Gagal membuat akun');
    }

    const userId = created.user.id;
    const { error: profileError } = await admin
      .from('profiles')
      .insert({ id: userId, username, full_name: fullName, role });
    const { error: locError } = profileError || locationIds.length === 0
      ? { error: null }
      : await admin
          .from('user_locations')
          .insert(locationIds.map((location_id) => ({ user_id: userId, location_id, created_by: me.id })));

    if (profileError || locError) {
      // Rollback: jangan tinggalkan akun Auth tanpa profil/lokasi yang benar.
      await admin.from('user_locations').delete().eq('user_id', userId);
      await admin.from('profiles').delete().eq('id', userId);
      await admin.auth.admin.deleteUser(userId);
      return fail(400, 'VALIDATION', 'Gagal menyimpan profil atau lokasi user');
    }

    await admin.from('audit_logs').insert({
      actor_id: me.id,
      action: 'USER_CREATED',
      table_name: 'profiles',
      record_id: userId,
      new_data: { username, full_name: fullName, role, location_ids: locationIds },
    });
    return reply(200, { id: userId });
  }

  // 2b. Reset password
  if (body.action === 'reset_password') {
    const userId = String(body.user_id ?? '');
    if (!UUID.test(userId)) return fail(400, 'VALIDATION', 'User tidak valid');
    if (!validPassword(body.password)) {
      return fail(400, 'VALIDATION', 'Password minimal 8 karakter dan mengandung huruf serta angka');
    }
    const { data: target } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (!target) return fail(404, 'NOT_FOUND', 'User tidak ditemukan');

    const { error } = await admin.auth.admin.updateUserById(userId, { password: body.password });
    if (error) return fail(500, 'UNKNOWN', 'Gagal mereset password');

    await admin.from('audit_logs').insert({
      actor_id: me.id,
      action: 'USER_PASSWORD_RESET',
      table_name: 'profiles',
      record_id: userId,
    });
    return reply(200, { ok: true });
  }

  return fail(400, 'VALIDATION', 'Action tidak dikenal');
});
