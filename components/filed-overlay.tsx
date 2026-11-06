"use client";

import { useEffect, useEffectEvent } from "react";
import { createPortal } from "react-dom";

// Plays after an accusation is submitted: the charge sheet drops in, gets
// stamped FILED, then flies off into the night.
export function FiledOverlay({
  name,
  reason,
  onDone,
}: {
  name: string;
  reason: string;
  onDone: () => void;
}) {
  const done = useEffectEvent(onDone);
  useEffect(() => {
    const id = setTimeout(() => done(), 2600);
    return () => clearTimeout(id);
  }, []);

  // Portal to <body>: a blurred ancestor would otherwise trap position:fixed.
  return createPortal(
    <div
      aria-live="polite"
      className="fixed inset-0 z-50 flex animate-overlay items-center justify-center bg-night-950/80 px-6 backdrop-blur-sm"
      onClick={onDone}
      role="presentation"
    >
      <div className="w-full max-w-sm animate-fly-away">
        <div className="relative animate-drop-in rounded-3xl bg-foam p-6 text-ink shadow-[0_12px_0_0_rgb(0_0_0/0.4)]">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-ink/50">Accusation against</p>
          <p className="mt-1 font-display text-4xl leading-none">{name}</p>
          <p className="mt-3 line-clamp-3 break-words text-lg font-semibold leading-snug">“{reason}”</p>

          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="animate-stamp rounded-xl border-[5px] border-double border-fine-500 bg-foam/70 px-5 py-1 font-display text-5xl uppercase tracking-wider text-fine-500 [animation-delay:0.55s]">
              Filed
            </span>
          </div>
        </div>
        <p className="mt-6 animate-rise text-center text-lg font-semibold text-foam [animation-delay:0.9s]">
          Sent anonymously. Nobody will know it was you.
        </p>
      </div>
    </div>,
    document.body,
  );
}
