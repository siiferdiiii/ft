import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin Client menggunakan Service Role Key
 * Digunakan untuk bypass batasan email rate limit & auto-confirm email user baru.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !url ||
    !serviceRoleKey ||
    url.includes("example.supabase.co") ||
    serviceRoleKey.includes("dummy")
  ) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
