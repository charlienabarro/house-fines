"use client";

import { useOptimistic, useState, useTransition } from "react";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { buildTally, joinNames, topOf, type TallyRow } from "@/lib/tally";
import type { AppState, Member, Motion, PartyData, Vote, VoteChoice } from "@/lib/types";
import { HostPartyBar } from "./host-party-bar";
import { Reveal } from "./reveal";
import { StatusBadge } from "./status-badge";
import { useToast } from "./toast";
import { Card } from "./ui";

type Props = {
  me: Member;
  members: Member[];
  state: AppState;
  party: PartyData;
  refresh: () => Promise<void>;
};

export function PartyMode({ me, members, state, party, refresh }: Props) {
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? "Someone";

  // The id of the motion whose verdict has finished its drumroll on this
  // phone. Until then, keep it out of the tally so nothing spoils the reveal.
  const [verdictShown, setVerdictShown] = useState<string | null>(null);

  const current = party.motions.find((m) => m.id === state.current_motion_id) ?? null;
  const hiding = current && current.status !== "active" && verdictShown !== current.id ? current.id : null;
  const visible = hiding ? party.motions.filter((m) => m.id !== hiding) : party.motions;
  const heard = visible
    .filter((m) => m.status === "passed" || m.status === "failed" || m.status === "skipped")
    .sort((a, b) => (a.opened_at ?? "").localeCompare(b.opened_at ?? ""));
  const broughtUp = party.motions.filter((m) => m.status !== "pending").length;
  const remaining = Math.max(0, party.total - broughtUp);
  const tally = buildTally(visible, members);
  const involved = members.filter((m) => m.active);
  const eligible =
    involved.length -
    (!state.accused_can_vote && current && involved.some((m) => m.id === current.accused_id) ? 1 : 0);

  let stage;
  if (current) {
    stage = (
      <MotionStage
        key={current.id}
        motion={current}
        state={state}
        me={me}
        votes={party.votes}
        eligible={eligible}
        nameOf={nameOf}
        refresh={refresh}
        onVerdictShown={() => setVerdictShown(current.id)}
      />
    );
  } else if (remaining > 0 || heard.length === 0) {
    stage = <WaitingStage remaining={remaining} started={heard.length > 0} isHost={me.is_host} />;
  } else {
    stage = <WrapStage tally={tally} heardCount={heard.length} isHost={me.is_host} />;
  }

  return (
    <div className={`space-y-5 ${me.is_host ? "pb-48" : ""}`}>
      <div className="flex items-center justify-between">
        {state.practice ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-beer-400/15 px-3 py-1 text-sm font-bold text-beer-300 ring-1 ring-beer-400/40">
            <span className="size-2 animate-glow rounded-full bg-beer-400" />
            Practice run · nothing is saved
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-fine-500/15 px-3 py-1 text-sm font-bold text-fine-400 ring-1 ring-fine-500/40">
            <span className="size-2 animate-glow rounded-full bg-fine-500" />
            Fines night is live
          </span>
        )}
        <span className="text-sm text-night-300">
          {heard.length} heard · {remaining} to go
        </span>
      </div>

      {stage}

      <TonightTally tally={tally} heard={heard} nameOf={nameOf} />

      {me.is_host ? (
        <HostPartyBar
          state={state}
          current={current}
          remaining={remaining}
          heardCount={heard.length}
          eligible={eligible}
          pending={party.motions.filter((m) => m.status === "pending")}
          members={members}
          refresh={refresh}
        />
      ) : null}
    </div>
  );
}

function MotionStage({
  motion,
  state,
  me,
  votes,
  eligible,
  nameOf,
  refresh,
  onVerdictShown,
}: {
  motion: Motion;
  state: AppState;
  me: Member;
  votes: Vote[];
  eligible: number;
  nameOf: (id: string) => string;
  refresh: () => Promise<void>;
  onVerdictShown: () => void;
}) {
  const accused = nameOf(motion.accused_id);
  const isMe = motion.accused_id === me.id;
  const myVote = votes.find((v) => v.motion_id === motion.id && v.member_id === me.id)?.vote ?? null;
  const canVote = me.active && (state.accused_can_vote || !isMe);
  const revealed = state.phase === "revealed" && (motion.status === "passed" || motion.status === "failed");

  return (
    <section className="space-y-5">
      <div className="animate-pop-in text-center">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-night-300">In the dock</p>
        <h2 className="mt-1 animate-slam break-words font-display text-6xl leading-[0.95] text-beer-300 drop-shadow-[0_5px_0_rgb(0_0_0/0.45)]">
          {accused}
        </h2>
        {isMe ? (
          <p className="mt-3 inline-block rounded-full bg-fine-500/20 px-3 py-1 text-sm font-semibold text-fine-400">
            That&apos;s you 😬
          </p>
        ) : null}
      </div>

      <ChargeSheet reason={motion.reason} punishment={motion.punishment} />

      {state.phase === "voting" ? (
        <VotePanel
          motion={motion}
          myVote={myVote}
          canVote={canVote}
          benched={!me.active}
          eligible={eligible}
          refresh={refresh}
        />
      ) : null}
      {revealed ? <Reveal motion={motion} votes={votes} accused={accused} nameOf={nameOf} onShown={onVerdictShown} /> : null}
    </section>
  );
}

function ChargeSheet({ reason, punishment }: { reason: string; punishment: string | null }) {
  return (
    <div className="relative rotate-[-1deg] animate-pop-in rounded-3xl bg-foam p-5 text-ink shadow-[0_10px_0_0_rgb(0_0_0/0.35)] [animation-delay:0.1s]">
      <span className="absolute -top-3 right-5 rotate-6 rounded-md bg-fine-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
        Anonymous
      </span>
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-ink/50">The charge</p>
      <p className="mt-2 break-words text-xl font-semibold leading-snug">“{reason}”</p>
      {punishment ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-beer-400 px-3 py-1 text-sm font-bold">
          🍺 Suggested fine: {punishment}
        </p>
      ) : null}
    </div>
  );
}

function VotePanel({
  motion,
  myVote,
  canVote,
  benched,
  eligible,
  refresh,
}: {
  motion: Motion;
  myVote: VoteChoice | null;
  canVote: boolean;
  benched: boolean;
  eligible: number;
  refresh: () => Promise<void>;
}) {
  const notify = useToast();
  const [shown, setShown] = useOptimistic(myVote);
  const [busy, startTransition] = useTransition();

  const vote = (choice: VoteChoice) =>
    startTransition(async () => {
      setShown(choice);
      const { error } = await createClient().rpc("cast_vote", {
        p_motion_id: motion.id,
        p_vote: choice,
      });
      if (error) notify(error.message, "error");
      await refresh();
    });

  if (!canVote) {
    return (
      <Card className="space-y-3 text-center">
        <p className="text-4xl">{benched ? "🪑" : "🤐"}</p>
        <p className="font-semibold">
          {benched
            ? "You're on the bench tonight, so you're just watching."
            : "You're in the dock, so no vote on this one."}
        </p>
        <VoteProgress cast={motion.votes_cast} eligible={eligible} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-center font-display text-2xl">Cast your vote</p>
      <div className="grid grid-cols-2 gap-3">
        <VoteButton choice="fine" shown={shown} disabled={busy} onClick={() => vote("fine")} />
        <VoteButton choice="no_fine" shown={shown} disabled={busy} onClick={() => vote("no_fine")} />
      </div>
      <p className="text-center text-sm text-night-300">
        {shown
          ? `You voted ${shown === "fine" ? "Fine" : "No fine"}. Tap the other one to change your mind.`
          : "Votes stay secret until the host closes voting."}
      </p>
      <VoteProgress cast={motion.votes_cast} eligible={eligible} />
    </div>
  );
}

function VoteButton({
  choice,
  shown,
  disabled,
  onClick,
}: {
  choice: VoteChoice;
  shown: VoteChoice | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const selected = shown === choice;
  const dimmed = shown !== null && !selected;
  const fine = choice === "fine";
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex h-36 flex-col items-center justify-center gap-1 rounded-[1.75rem] font-display text-3xl tracking-wide transition active:translate-y-1 ${
        fine
          ? "bg-fine-500 text-white shadow-[0_8px_0_0_var(--color-fine-700)]"
          : "bg-letoff-500 text-ink shadow-[0_8px_0_0_var(--color-letoff-700)]"
      } ${selected ? "scale-[1.03] ring-4 ring-foam" : ""} ${dimmed ? "opacity-45 saturate-50" : ""}`}
    >
      <span className="text-4xl">{fine ? "Fine" : "No fine"}</span>
      {selected ? (
        <span aria-hidden className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-foam font-sans text-base text-ink">
          ✓
        </span>
      ) : null}
    </button>
  );
}

export function VoteProgress({ cast, eligible }: { cast: number; eligible: number }) {
  const slots = Math.max(eligible, cast);
  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: slots }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 max-w-8 flex-1 rounded-full transition-colors ${i < cast ? "bg-beer-400" : "bg-white/15"}`}
          />
        ))}
      </div>
      <p className="text-center text-sm font-semibold">
        {cast} of {eligible} voted{cast >= eligible && eligible > 0 ? " – everyone's in!" : ""}
      </p>
    </div>
  );
}

function WaitingStage({ remaining, started, isHost }: { remaining: number; started: boolean; isHost: boolean }) {
  return (
    <Card className="py-8 text-center">
      <p className="inline-block animate-wobble text-6xl">🍻</p>
      <h2 className="mt-3 font-display text-4xl">{started ? "Next motion coming up" : "Fines night is ON"}</h2>
      <p className="mt-2 text-night-300">
        {remaining > 0 ? `${plural(remaining, "motion")} in the pot.` : "No motions this week. A miracle."}
      </p>
      <p className="mt-1 text-sm text-night-400">
        {isHost
          ? remaining > 0
            ? "Call the first motion when everyone's got a drink."
            : "Nothing to hear. End fines night when you're ready."
          : "Waiting for the host…"}
      </p>
    </Card>
  );
}

function WrapStage({ tally, heardCount, isHost }: { tally: TallyRow[]; heardCount: number; isHost: boolean }) {
  const top = topOf(tally);
  return (
    <Card className="py-8 text-center">
      <p className="text-6xl">🎉</p>
      <h2 className="mt-2 font-display text-4xl">That&apos;s a wrap!</h2>
      <p className="mt-1 text-night-300">{plural(heardCount, "motion")} heard tonight.</p>
      {top.fines > 0 ? (
        <p className="mt-4">
          Most fined tonight
          <span className="mt-1 block font-display text-3xl text-beer-300">{joinNames(top.names)}</span>
          <span className="text-night-300">with {plural(top.fines, "fine")}</span>
        </p>
      ) : (
        <p className="mt-4">Nobody got fined. Suspicious.</p>
      )}
      {isHost ? (
        <p className="mt-4 text-sm text-night-400">
          End fines night to archive everything and reopen submissions.
        </p>
      ) : null}
    </Card>
  );
}

function TonightTally({
  tally,
  heard,
  nameOf,
}: {
  tally: TallyRow[];
  heard: Motion[];
  nameOf: (id: string) => string;
}) {
  return (
    <Card>
      <h3 className="font-display text-2xl tracking-wide">Tonight&apos;s tally</h3>
      {tally.length === 0 ? (
        <p className="mt-2 text-night-300">No fines yet. Suspiciously well behaved.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {tally.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <span className="w-6 text-center font-display text-xl text-night-300">{row.rank}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{row.name}</span>
              <span aria-hidden className="tracking-tighter">
                {"🍺".repeat(Math.min(row.fines, 6))}
              </span>
              <span className="w-7 text-right font-display text-2xl text-beer-300">{row.fines}</span>
            </li>
          ))}
        </ol>
      )}

      {heard.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-night-300">
            Motions heard ({heard.length})
          </summary>
          <ul className="mt-3 space-y-2.5">
            {heard.map((m) => (
              <li key={m.id} className="flex items-start gap-2 text-sm">
                <StatusBadge status={m.status} />
                <span className="min-w-0 break-words">
                  <span className="font-semibold">{nameOf(m.accused_id)}</span>{" "}
                  <span className="text-night-300">{m.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}
