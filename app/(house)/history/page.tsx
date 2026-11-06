import type { Metadata } from "next";
import { Suspense } from "react";
import { NotAMember } from "@/components/not-a-member";
import { PintLoader } from "@/components/pint-loader";
import { StatusBadge } from "@/components/status-badge";
import { formatWeek, plural } from "@/lib/format";
import { getHouse } from "@/lib/house";
import { buildTally, joinNames, topOf } from "@/lib/tally";
import type { Member, MotionStatus } from "@/lib/types";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <Suspense fallback={<PintLoader label="Digging through the archives…" />}>
      <History />
    </Suspense>
  );
}

type ArchivedMotion = {
  id: string;
  accused_id: string;
  reason: string;
  punishment: string | null;
  status: MotionStatus;
  fine_votes: number | null;
  no_fine_votes: number | null;
  opened_at: string | null;
};

type ArchivedWeek = {
  id: number;
  deadline: string;
  archived_at: string | null;
  motions: ArchivedMotion[];
};

async function History() {
  const { supabase, me, members } = await getHouse();
  if (!me) return <NotAMember />;

  const [weeksRes, finesRes] = await Promise.all([
    supabase
      .from("weeks")
      .select(
        "id, deadline, archived_at, motions(id, accused_id, reason, punishment, status, fine_votes, no_fine_votes, opened_at)",
      )
      .eq("status", "archived")
      .order("deadline", { ascending: false })
      .limit(30),
    // All-time fines, across every archived week.
    supabase
      .from("motions")
      .select("accused_id, status, weeks!inner(status)")
      .eq("status", "passed")
      .eq("weeks.status", "archived"),
  ]);

  const weeks = ((weeksRes.data as ArchivedWeek[] | null) ?? []).filter((w) => w.motions.length > 0);
  const allTime = buildTally((finesRes.data as { accused_id: string; status: string }[] | null) ?? [], members);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? "Someone";

  if (weeksRes.error || finesRes.error) {
    return (
      <p className="rounded-2xl bg-fine-500/15 px-4 py-3 text-sm text-fine-400 ring-1 ring-fine-500/40">
        Couldn&apos;t load the history: {(weeksRes.error ?? finesRes.error)?.message}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl tracking-wide">History</h1>
      <HallOfShame tally={allTime} members={members} />

      {weeks.length === 0 ? (
        <section className="rounded-[1.75rem] bg-night-800/85 p-6 text-center ring-1 ring-white/10">
          <p className="text-5xl">📜</p>
          <p className="mt-2 font-display text-2xl">No fines nights yet</p>
          <p className="mt-1 text-night-300">Once the host ends a fines night, it lands here.</p>
        </section>
      ) : (
        weeks.map((week) => <WeekCard key={week.id} week={week} members={members} nameOf={nameOf} />)
      )}
    </div>
  );
}

function HallOfShame({ tally, members }: { tally: ReturnType<typeof buildTally>; members: Member[] }) {
  const max = tally[0]?.fines ?? 0;
  const medals = ["🥇", "🥈", "🥉"];
  const clean = members.filter((m) => !tally.some((t) => t.id === m.id)).map((m) => m.display_name);

  return (
    <section className="rounded-[1.75rem] bg-night-800/85 p-5 ring-1 ring-beer-400/30">
      <h2 className="font-display text-2xl tracking-wide">🏆 Hall of Shame</h2>
      <p className="text-sm text-night-300">Most fined of all time</p>
      {tally.length === 0 ? (
        <p className="mt-3 text-night-300">Nobody&apos;s been fined yet. Give it time.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {tally.map((row) => (
            <li key={row.id}>
              <div className="flex items-center gap-2">
                <span className="w-7 text-center text-lg">{medals[row.rank - 1] ?? row.rank}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{row.name}</span>
                <span className="font-display text-2xl text-beer-300">{row.fines}</span>
              </div>
              <div className="ml-9 mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full origin-left animate-grow-x rounded-full bg-beer-400"
                  style={{ width: `${(row.fines / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      {clean.length > 0 && tally.length > 0 ? (
        <p className="mt-4 text-sm text-night-300">
          😇 Clean record: <span className="text-foam">{joinNames(clean)}</span>
        </p>
      ) : null}
    </section>
  );
}

function WeekCard({
  week,
  members,
  nameOf,
}: {
  week: ArchivedWeek;
  members: Member[];
  nameOf: (id: string) => string;
}) {
  const motions = [...week.motions].sort(
    (a, b) => (a.opened_at ?? "~").localeCompare(b.opened_at ?? "~"),
  );
  const fined = motions.filter((m) => m.status === "passed").length;
  const letOff = motions.filter((m) => m.status === "failed").length;
  const top = topOf(buildTally(motions, members));

  return (
    <section className="rounded-[1.75rem] bg-night-800/85 p-5 ring-1 ring-white/10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl tracking-wide">
          <span className="block text-xs font-sans font-bold uppercase tracking-[0.2em] text-night-400">
            Week ending
          </span>
          {formatWeek(week.deadline)}
        </h2>
        <p className="shrink-0 text-sm text-night-300">
          <span className="text-fine-400">{fined} fined</span> ·{" "}
          <span className="text-letoff-400">{letOff} let off</span>
        </p>
      </div>
      {top.fines > 0 ? (
        <p className="mt-2 text-sm">
          Most fined: <span className="font-semibold text-beer-300">{joinNames(top.names)}</span> (
          {plural(top.fines, "fine")})
        </p>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-night-300">
          See the motions ({motions.length})
        </summary>
        <ul className="mt-3 space-y-3">
          {motions.map((m) => (
            <li key={m.id} className="rounded-2xl bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{nameOf(m.accused_id)}</span>
                <StatusBadge status={m.status} />
              </div>
              <p className="mt-1 break-words text-sm text-night-300">{m.reason}</p>
              <p className="mt-1 text-xs text-night-400">
                {m.punishment ? `🍺 ${m.punishment}` : null}
                {m.fine_votes !== null && m.no_fine_votes !== null ? (
                  <span className={m.punishment ? "ml-2" : undefined}>
                    Votes {m.fine_votes}–{m.no_fine_votes}
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
