// Shapes of the rows in supabase/migrations/*.sql

export type AppMode = "submit" | "party";
export type PartyPhase = "discussion" | "voting" | "revealed";
export type MotionStatus = "pending" | "active" | "passed" | "failed" | "skipped";
export type VoteChoice = "fine" | "no_fine";

export interface Member {
  id: string;
  username: string;
  display_name: string;
  is_host: boolean;
  /** False when the host has them sitting this one out. */
  active: boolean;
}

export interface AppState {
  id: number;
  mode: AppMode;
  phase: PartyPhase | null;
  current_motion_id: string | null;
  accused_can_vote: boolean;
  submission_limit: number;
  party_started_at: string | null;
  /** A practice run: ending it resets everything instead of archiving. */
  practice: boolean;
  updated_at: string;
}

export interface Motion {
  id: string;
  week_id: number;
  accused_id: string;
  reason: string;
  punishment: string | null;
  status: MotionStatus;
  votes_cast: number;
  fine_votes: number | null;
  no_fine_votes: number | null;
  created_at: string;
  opened_at: string | null;
  resolved_at: string | null;
}

export interface Vote {
  motion_id: string;
  member_id: string;
  vote: VoteChoice;
}

// Returned by the submit_status() database function.
export interface SubmitStatus {
  deadline: string;
  motion_count: number;
  waiting_count: number;
  my_count: number;
  limit: number;
}

export interface PendingMotion extends Motion {
  weeks: { deadline: string; status: string } | null;
}

export interface PartyData {
  motions: Motion[];
  votes: Vote[];
  /** Every motion in tonight's weeks, including ones nobody can see yet. */
  total: number;
}

export interface SubmitData {
  status: SubmitStatus;
  /** Host only: motions waiting in the pot. */
  pending: PendingMotion[];
}

export interface HouseData {
  state: AppState;
  submit: SubmitData | null;
  party: PartyData | null;
}
