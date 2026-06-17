import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS/Storage policies. Use ONLY in server code
// after an explicit auth/permission check. Never import from client components.
export function createSupabaseService() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
