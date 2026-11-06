"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { createPortal } from "react-dom";
import type { Motion, Vote } from "@/lib/types";

const SUSPENSE_MS = 1800;

// The big moment. A drumroll pause, then the verdict slams down with a flash
// and a shake, the votes count up, and everyone sees who voted which way.
export function Reveal({
  motion,
  votes,
  accused,
  nameOf,
  onShown,
}: {
  motion: Motion;
  votes: Vote[];
  accused: string;
  nameOf: (id: string) => string;
  /** Called when the drumroll ends and the verdict appears. */
  onShown?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const shown = useEffectEvent(() => onShown?.());
  useEffect(() => {
    const id = setTimeout(() => {
      setRevealed(true);
      shown();
    }, SUSPENSE_MS);
    return () => clearTimeout(id);
  }, []);

  if (!revealed) return <DrumRoll />;
  return <Verdict motion={motion} votes={votes} accused={accused} nameOf={nameOf} />;
}

function DrumRoll() {
  return (
    <div className="flex flex-col items-center gap-4 py-10" role="status">
      <p className="animate-suspense text-center font-display text-4xl tracking-wide">The house has spoken</p>
      <div className="flex gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-3 animate-drumroll rounded-full bg-beer-400"
            style={{ animationDelay: `${i * 0.06}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function Verdict({
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
    <div className="space-y-5 animate-quake [animation-delay:0.3s]">
      <Overlay>
        <div
          aria-hidden
          className={`pointer-events-none fixed inset-0 z-40 animate-flash [animation-delay:0.25s] ${
            passed ? "bg-fine-500" : "bg-letoff-500"
          }`}
        />
        {passed ? <BeerRain /> : null}
      </Overlay>

      <div className="flex justify-center py-4">
        <div
          className={`animate-stamp rounded-2xl border-[6px] border-double px-6 py-2 font-display text-6xl uppercase tracking-wider [animation-delay:0s] ${
            passed
              ? "border-fine-500 bg-fine-500/10 text-fine-500"
              : "border-letoff-500 bg-letoff-500/10 text-letoff-500"
          }`}
        >
          {passed ? "Fined!" : "Let off"}
        </div>
      </div>

      <p className="animate-rise text-center text-xl font-semibold [animation-delay:0.7s]">
        {passed ? (
          <>
            {accused} drinks
            {motion.punishment ? (
              <>
                : <span className="text-beer-300">{motion.punishment}</span>
              </>
            ) : (
              "!"
            )}
          </>
        ) : (
          <>{accused} walks free. This time.</>
        )}
      </p>
      {why ? <p className="-mt-3 text-center text-sm text-night-300">{why}</p> : null}

      <ResultBar fine={fine} noFine={noFine} />

      <div className="grid grid-cols-2 gap-3">
        <VoterColumn label="Fine" names={names("fine")} tone="fine" />
        <VoterColumn label="No fine" names={names("no_fine")} tone="letoff" />
      </div>
    </div>
  );
}

// Full-screen effects go straight into <body> so no parent can clip them.
function Overlay({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

function CountUp({ to, delayMs = 0 }: { to: number; delayMs?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now() + delayMs;
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      setShown(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, delayMs]);
  return <>{shown}</>;
}

function ResultBar({ fine, noFine }: { fine: number; noFine: number }) {
  const total = fine + noFine;
  const finePct = total === 0 ? 50 : (fine / total) * 100;
  return (
    <div className="animate-rise [animation-delay:0.5s]">
      <div className="mb-1.5 flex justify-between font-display text-4xl leading-none tabular-nums">
        <span className="text-fine-400">
          <CountUp to={fine} delayMs={600} />
        </span>
        <span className="text-letoff-400">
          <CountUp to={noFine} delayMs={600} />
        </span>
      </div>
      <div className="flex h-5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
        <div className="h-full origin-left animate-grow-x bg-fine-500" style={{ width: `${finePct}%` }} />
        <div
          className="h-full origin-right animate-grow-x bg-letoff-500"
          style={{ width: `${100 - finePct}%` }}
        />
      </div>
    </div>
  );
}

function VoterColumn({ label, names, tone }: { label: string; names: string[]; tone: "fine" | "letoff" }) {
  return (
    <div
      className={`rounded-3xl p-4 ring-1 ${
        tone === "fine" ? "bg-fine-500/10 ring-fine-500/40" : "bg-letoff-500/10 ring-letoff-500/40"
      }`}
    >
      <p className={`font-display text-xl ${tone === "fine" ? "text-fine-400" : "text-letoff-400"}`}>
        {label} · {names.length}
      </p>
      {names.length === 0 ? (
        <p className="mt-2 text-sm text-night-400">Nobody</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {names.map((name, i) => (
            <li
              key={`${name}-${i}`}
              className="animate-pop-in rounded-full bg-white/10 px-2.5 py-1 text-sm font-semibold"
              style={{ animationDelay: `${1.1 + i * 0.15}s` }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Deterministic "random" drops so every phone shows the same shower.
const DROPS = Array.from({ length: 24 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: 0.4 + ((i * 7) % 13) / 10,
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
