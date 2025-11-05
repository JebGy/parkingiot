import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // We avoid throwing at import time to not break build; warn instead.
  // Runtime components should handle missing envs gracefully.
  // eslint-disable-next-line no-console
  console.warn("Supabase env vars are missing: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY");
}

export const supabaseClient = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");