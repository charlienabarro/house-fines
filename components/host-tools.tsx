"use client";

import { useState, useTransition } from "react";
import { formatDeadline, formatShortDay, plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { AppState, Member, Motion, PendingMotion, SubmitData } from "@/lib/types";
import { useToast } from "./toast";
import { Button, Card, Sheet, Switch } from "./ui";

type Refresh = () => Promise<void>;

// Host panel shown under the form in submit mode.
export function HostSubmitPanel({
  state,
  submit,
  members,
  refresh,
}: {
  state: AppState;
  submit: SubmitData;
  members: Member[];
  refresh: Refresh;
}) {
  const notify = useToast();
  const [busy, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const { status, pending } = submit;

  const start = (includeCurrent: boolean, practice = false) => {
    setAsking(false);
    setPracticing(false);
    startTransition(async () => {
      const { error } = await createClient().rpc("start_party", {
        p_include_current: includeCurrent,
        p_practice: practice,
      });
      if (error) notify(error.message, "error");
      await refresh();
    });
  };

  // If this week's submissions are still open, check before closing them.
  const onStart = () => (status.motion_count > 0 ? setAsking(true) : start(false));

  const ready =
    status.waiting_count > 0
      ? `${plural(status.waiting_count, "motion")} ready to go.`
      : status.motion_count > 0
        ? `This week's ${plural(status.motion_count, "motion")} unlock at the deadline, or close early.`
        : "No motions yet.";

  return (
    <Card className="ring-beer-400/30">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">👑 Host controls</h2>
        <span className="text-xs text-night-400">Only you see this</span>
      </div>

      <Button size="lg" className="mt-4 w-full" onClick={onStart} busy={busy}>
        Start fines night
      </Button>
      <p className="mt-2 text-center text-sm text-night-300">{ready}</p>
      <Button variant="ghost" className="mt-3 w-full" onClick={() => setPracticing(true)} disabled={busy}>
        Practice run
      </Button>

      <Sheet open={practicing} onClose={() => setPracticing(false)} title="Practice run?">
        <p className="text-night-300">
          Runs fines night for real with all the motions submitted so far, so you can test it on a
          few phones. When you end it, everything goes back exactly as it was: nothing is
          archived, votes are wiped and submissions reopen.
        </p>
        <p className="mt-3 text-sm text-fine-400">
          Anyone who opens the site while it&apos;s running will see party mode and the
          accusations too.
        </p>
        <div className="mt-5 grid gap-3">
          <Button size="lg" onClick={() => start(true, true)}>
            Start practice
          </Button>
          <Button variant="ghost" onClick={() => setPracticing(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>

      <div className="mt-5 space-y-3">
        <HostSettings state={state} refresh={refresh} />
        <MotionQueue motions={pending} members={members} refresh={refresh} heading="In the pot" />
      </div>

      <Sheet open={asking} onClose={() => setAsking(false)} title="Close submissions early?">
        <p className="text-night-300">
          Submissions are open until {formatDeadline(status.deadline)}. Close them now so this
          week&apos;s {plural(status.motion_count, "motion")} are included? Afterwards the countdown
          carries on to {formatDeadline(status.deadline)} as normal, with everyone&apos;s count back
          at zero.
        </p>
        <div className="mt-5 grid gap-3">
          <Button size="lg" onClick={() => start(true)}>
            Close early and start
          </Button>
          {status.waiting_count > 0 ? (
            <Button variant="ghost" onClick={() => start(false)}>
              Just last week&apos;s {plural(status.waiting_count, "motion")}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => setAsking(false)}>
            Not yet
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

export function HostSettings({ state, refresh }: { state: AppState; refresh: Refresh }) {
  const notify = useToast();
  const [busy, startTransition] = useTransition();

  const save = (patch: Partial<Pick<AppState, "accused_can_vote" | "submission_limit">>) =>
    startTransition(async () => {
      const { error } = await createClient().from("app_state").update(patch).eq("id", 1);
      if (error) notify(error.message, "error");
      await refresh();
    });

  const limit = state.submission_limit;
  const step = "grid size-10 place-items-center rounded-xl bg-white/10 text-xl font-bold active:scale-95 disabled:opacity-40";

  return (
    <div className="space-y-2">
      <Switch
        label="Accused can vote"
        hint="Let people vote on motions against themselves"
        checked={state.accused_can_vote}
        onChange={(v) => save({ accused_can_vote: v })}
        disabled={busy}
      />
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-3">
        <span>
          <span className="block font-semibold">Motions per person</span>
          <span className="block text-sm text-night-300">each week, to stop spam</span>
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Fewer"
            className={step}
            disabled={busy || limit <= 1}
            onClick={() => save({ submission_limit: limit - 1 })}
          >
            −
          </button>
          <span className="w-8 text-center font-display text-2xl tabular-nums">{limit}</span>
          <button
            type="button"
            aria-label="More"
            className={step}
            disabled={busy || limit >= 100}
            onClick={() => save({ submission_limit: limit + 1 })}
          >
            +
          </button>
        </span>
      </div>
    </div>
  );
}

// Host-only list of motions nobody else can read yet, with a bin button for
// joke or abusive ones.
export function MotionQueue({
  motions,
  members,
  refresh,
  heading,
}: {
  motions: (Motion | PendingMotion)[];
  members: Member[];
  refresh: Refresh;
  heading: string;
}) {
  const notify = useToast();
  const [busy, startTransition] = useTransition();
  const [binning, setBinning] = useState<Motion | null>(null);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? "Someone";

  // Sorted by name, not arrival, so the order gives nothing away.
  const sorted = [...motions].sort(
    (a, b) => nameOf(a.accused_id).localeCompare(nameOf(b.accused_id)) || a.id.localeCompare(b.id),
  );
  const weeks = new Set(motions.map((m) => m.week_id));

  const bin = (motion: Motion) =>
    startTransition(async () => {
      const { data, error } = await createClient()
        .from("motions")
        .delete()
        .eq("id", motion.id)
        .select("id");
      if (error) notify(error.message, "error");
      else if (!data?.length) notify("Couldn't bin that one. It may already have been heard.", "error");
      else notify("Binned. 🗑️");
      setBinning(null);
      await refresh();
    });

  return (
    <>
      <details className="group rounded-2xl bg-white/5 ring-1 ring-white/10">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
          <span>
            {heading} ({motions.length})
          </span>
          <span className="text-sm text-night-300 group-open:hidden">Show</span>
          <span className="hidden text-sm text-night-300 group-open:inline">Hide</span>
        </summary>
        <div className="px-4 pb-3">
          <p className="text-xs text-night-400">
            Spoilers. Only you can see these. Bin anything that&apos;s a joke or out of order.
          </p>
          {sorted.length === 0 ? (
            <p className="py-3 text-sm text-night-300">Nothing here.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {sorted.map((m) => (
                <li key={m.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-beer-300">{nameOf(m.accused_id)}</p>
                    <p className="break-words text-sm">{m.reason}</p>
                    <p className="mt-0.5 text-xs text-night-300">
                      {m.punishment ? `🍺 ${m.punishment}` : null}
                      {weeks.size > 1 && "weeks" in m && m.weeks ? (
                        <span className="ml-2">for {formatShortDay(m.weeks.deadline)}</span>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Bin the motion against ${nameOf(m.accused_id)}`}
                    onClick={() => setBinning(m)}
                    className="h-10 shrink-0 rounded-xl px-3 text-sm font-semibold text-fine-400 ring-1 ring-white/15 active:scale-95"
                  >
                    Bin
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <Sheet open={binning !== null} onClose={() => setBinning(null)} title="Bin this motion?">
        {binning ? (
          <>
            <p className="text-night-300">
              Against <span className="font-semibold text-foam">{nameOf(binning.accused_id)}</span>:
            </p>
            <p className="mt-2 break-words rounded-2xl bg-white/5 p-3">“{binning.reason}”</p>
            <p className="mt-2 text-sm text-night-400">It&apos;s gone for good.</p>
            <div className="mt-5 grid gap-3">
              <Button variant="fine" busy={busy} onClick={() => bin(binning)}>
                Bin it
              </Button>
              <Button variant="ghost" onClick={() => setBinning(null)}>
                Keep it
              </Button>
            </div>
          </>
        ) : null}
      </Sheet>
    </>
  );
}
