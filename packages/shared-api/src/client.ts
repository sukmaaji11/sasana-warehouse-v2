import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@sasana/shared-types';

/** Client Supabase bertipe untuk seluruh app. Tiap app membuat instance-nya sendiri. */
export type SasanaClient = SupabaseClient<Database>;
