"use client";

import { useState, useTransition, type FormEvent } from "react";
import { formatDeadline, plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { AppState, Member, SubmitData, SubmitStatus } from "@/lib/types";
import { Countdown } from "./countdown";
import { FiledOverlay } from "./filed-overlay";
import { HostSubmitPanel } from "./host-tools";
import { useToast } from "./toast";
import { Button, Card } from "./ui";

const PUNISHMENTS = ["1 dig", "2 dig", "VK chop", "Beer chop"];

const field =
  "w-full rounded-2xl bg-night-950/70 px-4 text-base text-foam ring-1 ring-white/15 placeholder:text-night-400 focus:outline-none focus:ring-2 focus:ring-beer-400";

type Props = {
  me: Member;
  members: Member[];
  state: AppState;
  submit: SubmitData;
  refresh: () => Promise<void>;
};

export function SubmitMode({ me, members, state, submit, refresh }: Props) {
  return (
    <div className="space-y-5">
      <DeadlineCard status={submit.status} onExpire={refresh} />
      <MotionForm me={me} members={members} status={submit.status} refresh={refresh} />
      {me.is_host ? (
        <HostSubmitPanel state={state} submit={submit} members={members} refresh={refresh} />
      ) : null}
    </div>
  );
}

function DeadlineCard({ status, onExpire }: { status: SubmitStatus; onExpire: () => void }) {
  return (
    <Card>
      <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-beer-300">
        Submissions close in
      </p>
      <Countdown deadline={status.deadline} onExpire={onExpire} />
      <p className="mt-3 text-sm text-night-300">{formatDeadline(status.deadline)}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat value={String(status.motion_count)} label={`${status.motion_count === 1 ? "motion" : "motions"} in this week`} emoji="🍺" />
        <Stat value={`${status.my_count}/${status.limit}`} label="sent by you" emoji="🤫" />
      </div>

      {status.waiting_count > 0 ? (
        <p className="mt-3 rounded-xl bg-beer-400/10 px-3 py-2 text-sm text-beer-200">
          Plus {plural(status.waiting_count, "motion")} from last week waiting for fines night.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-night-400">
        Nobody can read the motions until fines night, and nobody can see who sent them.
      </p>
    </Card>
  );
}

function Stat({ value, label, emoji }: { value: string; label: string; emoji: string }) {
  return (
    <div className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-2xl">{emoji}</span>
        <span key={value} className="inline-block animate-bump font-display text-3xl leading-none">
          {value}
        </span>
      </div>
      <div className="mt-1 text-sm text-night-300">{label}</div>
    </div>
  );
}

function MotionForm({
  me,
  members,
  status,
  refresh,
}: {
  me: Member;
  members: Member[];
  status: SubmitStatus;
  refresh: () => Promise<void>;
}) {
  const notify = useToast();
  const [accused, setAccused] = useState("");
  const [reason, setReason] = useState("");
  const [punishment, setPunishment] = useState("");
  const [busy, startTransition] = useTransition();
  const [filed, setFiled] = useState<{ name: string; reason: string; key: number } | null>(null);
  const usedUp = status.my_count >= status.limit;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const { error } = await createClient().rpc("submit_motion", {
        p_accused_id: accused,
        p_reason: reason,
        p_punishment: punishment.trim() || null,
      });
      if (error) {
        notify(error.message, "error");
        return;
      }
      setFiled({
        name: members.find((m) => m.id === accused)?.display_name ?? "Someone",
        reason: reason.trim(),
        key: Date.now(),
      });
      setAccused("");
      setReason("");
      setPunishment("");
      await refresh();
    });
  };

  if (!me.active) {
    return (
      <Card className="text-center">
        <p className="text-4xl">🪑</p>
        <h2 className="mt-2 font-display text-3xl tracking-wide">You&apos;re on the bench</h2>
        <p className="mt-1 text-night-300">
          The host has you sitting this one out, so you can&apos;t submit, be accused or vote.
          You can still watch.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      {filed ? <FiledOverlay key={filed.key} name={filed.name} reason={filed.reason} onDone={() => setFiled(null)} /> : null}
      <h2 className="font-display text-3xl tracking-wide">Submit an accusation</h2>
      <p className="mt-1 text-sm text-night-300">Seen something? Say something. Anonymously.</p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Who&apos;s in the dock?</span>
          <span className="relative block">
            <select
              required
              value={accused}
              onChange={(e) => setAccused(e.target.value)}
              className={`${field} h-14 appearance-none pr-10`}
            >
              <option value="" disabled>
                Choose a housemate…
              </option>
              {members.filter((m) => m.active).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me.id ? `${m.display_name} (you – a confession?)` : m.display_name}
                </option>
              ))}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-night-300">
              ▾
            </span>
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="flex items-baseline justify-between text-sm font-semibold">
            What did they do?
            <span className={`text-xs font-normal ${reason.length > 480 ? "text-fine-400" : "text-night-400"}`}>
              {reason.length}/500
            </span>
          </span>
          <textarea
            required
            minLength={3}
            maxLength={500}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${field} resize-none py-3`}
          />
        </label>

        <div className="space-y-1.5">
          <label htmlFor="punishment" className="block text-sm font-semibold">
            Suggested fine <span className="font-normal text-night-400">(optional)</span>
          </label>
          <input
            id="punishment"
            maxLength={60}
            value={punishment}
            onChange={(e) => setPunishment(e.target.value)}
            placeholder="e.g. 2 dig"
            className={`${field} h-12`}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {PUNISHMENTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPunishment(p)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition active:scale-95 ${
                  punishment === p
                    ? "bg-beer-400 text-ink ring-beer-400"
                    : "bg-white/5 text-night-300 ring-white/15"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {usedUp ? (
          <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-night-300">
            You&apos;ve used all {status.limit} of your motions this week. Save some outrage for
            next week.
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" busy={busy} disabled={usedUp}>
          File it anonymously
        </Button>
      </form>
    </Card>
  );
}
