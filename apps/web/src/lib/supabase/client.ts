'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@sasana/shared-types';
import type { SasanaClient } from '@sasana/shared-api';
import { env } from '@/lib/env';

let client: SasanaClient | undefined;

/** Satu instance client Supabase di browser (anon/publishable key + sesi user). */
export function getSupabase(): SasanaClient {
  client ??= createBrowserClient<Database>(env.supabaseUrl, env.supabaseKey);
  return client;
}
