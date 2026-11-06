import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/env";

// In the browser @supabase/ssr hands back the same instance every time, so
// this is cheap to call from anywhere.
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
