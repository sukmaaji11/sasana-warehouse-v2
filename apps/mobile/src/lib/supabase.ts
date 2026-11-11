import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import type { SasanaClient } from '@sasana/shared-api';
import type { Database } from '@sasana/shared-types';
import { AppState } from 'react-native';

// Ditulis literal agar Expo meng-inline nilainya saat build.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diisi. Lihat apps/mobile/.env.example',
  );
}

/**
 * Client Supabase untuk Android. Hanya publishable (anon) key + sesi user.
 * Sesi disimpan di localStorage berbasis expo-sqlite (sandbox aplikasi), sesuai panduan Expo.
 */
export const supabase: SasanaClient = createClient<Database>(url, key, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh token hanya berjalan saat aplikasi aktif.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
