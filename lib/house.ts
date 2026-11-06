import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AppState, Member } from "@/lib/types";

const MEMBER_COLUMNS = "id, username, display_name, is_host";

// Data access for Server Components: who is signed in, the house list and
// the current mode. Reads the session, so call it inside a <Suspense>.
export async function getHouse() {
  // Always per-request: the session check reads cookies and the clock.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/login");

  const [meRes, membersRes, stateRes] = await Promise.all([
    supabase.from("members").select(MEMBER_COLUMNS).eq("id", userId).maybeSingle(),
    supabase.from("members").select(MEMBER_COLUMNS).order("display_name"),
    supabase.from("app_state").select("*").eq("id", 1).maybeSingle(),
  ]);

  return {
    supabase,
    me: (meRes.data as Member | null) ?? null,
    members: (membersRes.data as Member[] | null) ?? [],
    state: (stateRes.data as AppState | null) ?? null,
  };
}
