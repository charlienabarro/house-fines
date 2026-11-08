"use client";

import { useCallback, useRef, useState } from "react";
import { loadFor, loadMembers, loadState } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import type { AppMode, AppState, HouseData, Member, PartyData, SubmitData } from "@/lib/types";
import { PartyMode } from "./party-mode";
import { PintLoader } from "./pint-loader";
import { SubmitMode } from "./submit-mode";
import { ToastProvider, useToast } from "./toast";
import { useLiveRefresh } from "./use-live-refresh";

const LIVE_TABLES = ["app_state", "weeks", "motions", "members"] as const;

type Props = { me: Member; members: Member[]; initialState: AppState };

export function HouseApp(props: Props) {
  return (
    <ToastProvider>
      <House {...props} />
    </ToastProvider>
  );
}

function House({ me: initialMe, members: initialMembers, initialState }: Props) {
  const notify = useToast();
  const [members, setMembers] = useState(initialMembers);
  // Keep "me" in step with the live list (the host can switch people in and out).
  const me = members.find((m) => m.id === initialMe.id) ?? initialMe;
  const [data, setData] = useState<HouseData>({ state: initialState, submit: null, party: null });
  const [offline, setOffline] = useState(false);
  const latest = useRef(0);
  const lastMode = useRef<AppMode>(initialState.mode);

  // Re-read everything this screen needs. Called on every realtime nudge
  // and after every action, so the screen always matches the database.
  const refresh = useCallback(async () => {
    const id = ++latest.current;
    const supabase = createClient();
    try {
      const guess = lastMode.current;
      const [state, guessed, house] = await Promise.all([
        loadState(supabase),
        loadFor(guess, supabase, initialMe.is_host),
        loadMembers(supabase),
      ]);
      const modeData =
        state.mode === guess ? guessed : await loadFor(state.mode, supabase, initialMe.is_host);
      if (id !== latest.current) return; // a newer refresh has started

      if (state.mode !== lastMode.current) {
        notify(
          state.mode === "party"
            ? "Fines night is ON 🍻"
            : "Fines night's over. Submissions are open again.",
        );
        lastMode.current = state.mode;
      }
      setData(
        state.mode === "party"
          ? { state, party: modeData as PartyData, submit: null }
          : { state, submit: modeData as SubmitData, party: null },
      );
      setMembers(house);
      setOffline(false);
    } catch {
      if (id === latest.current) setOffline(true);
    }
  }, [initialMe.is_host, notify]);

  useLiveRefresh(LIVE_TABLES, refresh);

  const { state } = data;
  let body;
  if (state.mode === "party") {
    body = data.party ? (
      <PartyMode me={me} members={members} state={state} party={data.party} refresh={refresh} />
    ) : (
      <PintLoader label="Setting up the bar…" />
    );
  } else {
    body = data.submit ? (
      <SubmitMode me={me} members={members} state={state} submit={data.submit} refresh={refresh} />
    ) : (
      <PintLoader />
    );
  }

  return (
    <div className={state.mode === "party" ? "party-glow" : undefined}>
      {offline ? (
        <p className="mb-4 rounded-2xl bg-fine-500/15 px-4 py-3 text-sm text-fine-400 ring-1 ring-fine-500/40">
          Can&apos;t reach the house right now. Retrying…
        </p>
      ) : null}
      <div key={state.mode} className="animate-pop-in">
        {body}
      </div>
    </div>
  );
}
