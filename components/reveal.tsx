"use client";

import type { Motion, Vote } from "@/lib/types";

// The big moment: stamp the verdict, then show exactly who voted which way.
export function Reveal({
  motion,
  votes,
  accused,
  nameOf,
}: {
  motion: Motion;
  votes: Vote[];
  accused: string;
  nameOf: (id: string) => string;
}) {
  const passed = motion.status === "passed";
  const fine = motion.fine_votes ?? 0;
  const noFine = motion.no_fine_votes ?? 0;
  const total = fine + noFine;
  const names = (choice: Vote["vote"]) =>
    votes
      .filter((v) => v.motion_id === motion.id && v.vote === choice)
      .map((v) => nameOf(v.member_id))
      .sort((a, b) => a.localeCompare(b));

  const why =
    total === 0 ? "Nobody voted, so it fails." : fine === noFine ? "It's a tie, and ties fail." : null;

  return (
    <div className="space-y-5">
      {passed ? <BeerRain /> : null}

      <div className="flex justify-center py-4">
        <div
          className={`animate-stamp rounded-2xl border-[6px] border-double px-6 py-2 font-display text-6xl uppercase tracking-wider ${
            passed
              ? "border-fine-500 bg-fine-500/10 text-fine-500"
              : "border-letoff-500 bg-letoff-500/10 text-letoff-500"
          }`}
        >
          {passed ? "Fined!" : "Let off"}
        </div>
      </div>

      <p className="animate-rise text-center text-xl font-semibold [animation-delay:0.9s]">
        {passed ? (
          <>
            {accused} drinks
            {motion.punishment ? (
              <>
                : <span className="text-beer-300">{motion.punishment}</span>
              </>
            ) : (
              "!"
            )}{" "}
            🍺
          </>
        ) : (
          <>{accused} walks free. This time.</>
        )}
      </p>
      {why ? <p className="-mt-3 text-center text-sm text-night-300">{why}</p> : null}

      <ResultBar fine={fine} noFine={noFine} />

      <div className="grid grid-cols-2 gap-3">
        <VoterColumn label="Fine" emoji="🍺" names={names("fine")} tone="fine" />
        <VoterColumn label="No fine" emoji="😇" names={names("no_fine")} tone="letoff" />
      </div>
    </div>
  );
}

function ResultBar({ fine, noFine }: { fine: number; noFine: number }) {
  const total = fine + noFine;
  const finePct = total === 0 ? 50 : (fine / total) * 100;
  return (
    <div className="animate-rise [animation-delay:0.6s]">
      <div className="mb-1.5 flex justify-between font-display text-3xl leading-none">
        <span className="text-fine-400">{fine}</span>
        <span className="text-letoff-400">{noFine}</span>
      </div>
      <div className="flex h-5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
        <div
          className="h-full origin-left animate-grow-x bg-fine-500"
          style={{ width: `${finePct}%` }}
        />
        <div
          className="h-full origin-right animate-grow-x bg-letoff-500"
          style={{ width: `${100 - finePct}%` }}
        />
      </div>
    </div>
  );
}

function VoterColumn({
  label,
  emoji,
  names,
  tone,
}: {
  label: string;
  emoji: string;
  names: string[];
  tone: "fine" | "letoff";
}) {
  return (
    <div
      className={`rounded-3xl p-4 ring-1 ${
        tone === "fine" ? "bg-fine-500/10 ring-fine-500/40" : "bg-letoff-500/10 ring-letoff-500/40"
      }`}
    >
      <p className={`font-display text-xl ${tone === "fine" ? "text-fine-400" : "text-letoff-400"}`}>
        {emoji} {label} · {names.length}
      </p>
      {names.length === 0 ? (
        <p className="mt-2 text-sm text-night-400">Nobody</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {names.map((name, i) => (
            <li
              key={`${name}-${i}`}
              className="animate-pop-in rounded-full bg-white/10 px-2.5 py-1 text-sm font-semibold"
              style={{ animationDelay: `${1.1 + i * 0.12}s` }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Deterministic "random" drops so server and client agree.
const DROPS = Array.from({ length: 20 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: 0.5 + ((i * 7) % 13) / 10,
  size: 1.4 + ((i * 5) % 4) * 0.4,
  emoji: ["🍺", "🍻", "💸", "🥴"][i % 4],
}));

function BeerRain() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {DROPS.map((d, i) => (
        <span
          key={i}
          className="absolute -top-12 animate-fall"
          style={{ left: `${d.left}%`, animationDelay: `${d.delay}s`, fontSize: `${d.size}rem` }}
        >
          {d.emoji}
        </span>
      ))}
    </div>
  );
}
