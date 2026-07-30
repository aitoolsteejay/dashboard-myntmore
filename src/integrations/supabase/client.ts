import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const hasSupabaseConfig = Boolean(configuredUrl && configuredKey);
const SUPABASE_URL = configuredUrl ?? 'http://127.0.0.1:54321';
const SUPABASE_PUBLISHABLE_KEY = configuredKey ?? 'missing-supabase-publishable-key';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
