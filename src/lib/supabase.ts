import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase Credentials not found in Environment Variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
