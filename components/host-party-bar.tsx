"use client";

import { useState, useTransition, type ReactNode } from "react";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { AppState, Member, Motion } from "@/lib/types";
import { HostSettings, MotionQueue } from "./host-tools";
import { useToast } from "./toast";
import { Button, Sheet } from "./ui";

type HostFn = "next_motion" | "open_voting" | "close_voting" | "skip_motion" | "end_party";

// Sticky control bar at the bottom of the host's phone during fines night.
export function HostPartyBar({
  state,
  current,
  remaining,
  heardCount,
  eligible,
  pending,
  members,
  refresh,
}: {
  state: AppState;
  current: Motion | null;
  remaining: number;
  heardCount: number;
  eligible: number;
  pending: Motion[];
  members: Member[];
  refresh: () => Promise<void>;
}) {
  const notify = useToast();
  const [busy, startTransition] = useTransition();
  const [sheet, setSheet] = useState<null | "menu" | "end">(null);

  const call = (fn: HostFn) =>
    startTransition(async () => {
      setSheet(null);
      const { error } = await createClient().rpc(fn);
      if (error) notify(error.message, "error");
      await refresh();
    });

  const phase = current ? state.phase : null;
  const skip = (
    <Button variant="ghost" size="lg" className="px-4 text-xl" disabled={busy} onClick={() => call("skip_motion")}>
      Skip
    </Button>
  );

  let status: string;
  let controls: ReactNode;
  if (phase === "discussion") {
    status = "Discussing";
    controls = (
      <>
        <Button size="lg" className="flex-1" busy={busy} onClick={() => call("open_voting")}>
          Open voting
        </Button>
        {skip}
      </>
    );
  } else if (phase === "voting") {
    status = `Voting · ${current?.votes_cast ?? 0} of ${eligible} in`;
    controls = (
      <>
        <Button variant="fine" size="lg" className="flex-1" busy={busy} onClick={() => call("close_voting")}>
          Close &amp; reveal
        </Button>
        {skip}
      </>
    );
  } else if (remaining > 0) {
    status = `${plural(remaining, "motion")} left`;
    controls = (
      <Button size="lg" className="w-full" busy={busy} onClick={() => call("next_motion")}>
        {heardCount === 0 && !current ? "Call the first motion" : "Next motion"}
      </Button>
    );
  } else if (current) {
    status = "That was the last one";
    controls = (
      <Button size="lg" className="w-full" busy={busy} onClick={() => call("next_motion")}>
        Show the final tally
      </Button>
    );
  } else {
    status = "All done";
    controls = (
      <Button variant="fine" size="lg" className="w-full" onClick={() => setSheet("end")}>
        {state.practice ? "End practice" : "End fines night"}
      </Button>
    );
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="w-full max-w-lg rounded-[1.75rem] bg-night-900/95 p-3 shadow-[0_-10px_40px_-10px_rgb(0_0_0/0.8)] ring-1 ring-beer-400/30 backdrop-blur">
          <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
            <span className="truncate text-xs font-bold uppercase tracking-wider text-night-300">
              👑 Host · {status}
            </span>
            <button
              type="button"
              onClick={() => setSheet("menu")}
              className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-night-300 ring-1 ring-white/15 active:scale-95"
            >
              Settings &amp; queue
            </button>
          </div>
          <div className="flex gap-2">{controls}</div>
        </div>
      </div>

      <Sheet open={sheet === "menu"} onClose={() => setSheet(null)} title="Host menu">
        <div className="space-y-3">
          <HostSettings state={state} refresh={refresh} />
          <MotionQueue motions={pending} members={members} refresh={refresh} heading="Still in the pot" />
          <Button variant="danger" className="w-full" onClick={() => setSheet("end")}>
            {state.practice ? "End practice" : "End fines night"}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={sheet === "end"}
        onClose={() => setSheet(null)}
        title={state.practice ? "End practice?" : "End fines night?"}
      >
        <p className="text-night-300">
          {state.practice
            ? "Everything goes back exactly as it was: every motion becomes unheard again, votes are wiped, nothing is saved to history, and submissions reopen."
            : `This archives tonight's motions to the history page and switches everyone back to submissions.${
                remaining > 0 ? ` ${plural(remaining, "motion")} haven't been heard and will stay secret.` : ""
              }`}
        </p>
        <div className="mt-5 grid gap-3">
          <Button variant="fine" size="lg" busy={busy} onClick={() => call("end_party")}>
            End it
          </Button>
          <Button variant="ghost" onClick={() => setSheet(null)}>
            Keep partying
          </Button>
        </div>
      </Sheet>
    </>
  );
}
