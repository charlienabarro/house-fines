import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppMode,
  AppState,
  Motion,
  PartyData,
  PendingMotion,
  SubmitData,
  SubmitStatus,
  Vote,
} from "@/lib/types";

// Browser-side loaders. Each query runs as the signed-in user, so RLS
// decides what comes back (e.g. only the host gets pending motions).

const MOTION_COLUMNS =
  "id, week_id, accused_id, reason, punishment, status, votes_cast, fine_votes, no_fine_votes, created_at, opened_at, resolved_at";

function unwrap<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function loadState(supabase: SupabaseClient): Promise<AppState> {
  return unwrap<AppState>(await supabase.from("app_state").select("*").eq("id", 1).single());
}

export async function loadSubmit(supabase: SupabaseClient, isHost: boolean): Promise<SubmitData> {
  const [statusRes, pendingRes] = await Promise.all([
    supabase.rpc("submit_status"),
    isHost
      ? supabase
          .from("motions")
          .select(`${MOTION_COLUMNS}, weeks!inner(deadline, status)`)
          .eq("status", "pending")
          .eq("weeks.status", "open")
      : Promise.resolve({ data: [], error: null }),
  ]);
  return {
    status: unwrap<SubmitStatus>(statusRes),
    pending: unwrap<PendingMotion[]>(pendingRes),
  };
}

export async function loadParty(supabase: SupabaseClient): Promise<PartyData> {
  const [weeksRes, motionsRes, votesRes] = await Promise.all([
    supabase.from("weeks").select("motion_count").eq("status", "party"),
    supabase
      .from("motions")
      .select(`${MOTION_COLUMNS}, weeks!inner(status)`)
      .eq("weeks.status", "party"),
    supabase
      .from("votes")
      .select("motion_id, member_id, vote, motions!inner(weeks!inner(status))")
      .eq("motions.weeks.status", "party"),
  ]);

  const weeks = unwrap<{ motion_count: number }[]>(weeksRes);
  // (Rows also carry the joined `weeks` object; harmless, so it's left on.)
  const motions = unwrap<Motion[]>(motionsRes);
  const votes = unwrap<(Vote & { motions?: unknown })[]>(votesRes).map(
    ({ motion_id, member_id, vote }) => ({ motion_id, member_id, vote }),
  );

  return { total: weeks.reduce((sum, w) => sum + w.motion_count, 0), motions, votes };
}

export function loadFor(mode: AppMode, supabase: SupabaseClient, isHost: boolean) {
  return mode === "party" ? loadParty(supabase) : loadSubmit(supabase, isHost);
}
