import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_REQUEST_TIMEOUT_MS = 12000;
let cachedClient: SupabaseClient | null = null;

const fetchSupabase = (input: RequestInfo | URL, init?: RequestInit) => {
  return globalThis.fetch(input, {
    ...init,
    cache: "no-store",
  });
};

export function getSupabaseAdmin() {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase admin environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    db: {
      timeout: SUPABASE_REQUEST_TIMEOUT_MS,
    },
    global: {
      fetch: fetchSupabase,
    },
  });

  return cachedClient;
}
