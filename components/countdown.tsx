"use client";

import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { splitSeconds } from "@/lib/format";

const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
};
const nowSeconds = () => Math.floor(Date.now() / 1000);
const noClockOnServer = () => null;

export function Countdown({ deadline, onExpire }: { deadline: string; onExpire: () => void }) {
  const now = useSyncExternalStore<number | null>(subscribe, nowSeconds, noClockOnServer);
  const target = Math.floor(new Date(deadline).getTime() / 1000);
  const left = now === null ? null : Math.max(target - now, 0);
  const expired = left === 0;

  // When the clock hits zero, ask the server for the new deadline. Give it a
  // moment in case this phone's clock runs a little fast.
  const expire = useEffectEvent(onExpire);
  useEffect(() => {
    if (!expired) return;
    const id = setTimeout(() => expire(), 1500);
    return () => clearTimeout(id);
  }, [expired]);

  const parts = left === null ? null : splitSeconds(left);
  const cells: [string, number | undefined][] = [
    ["days", parts?.days],
    ["hrs", parts?.hours],
    ["mins", parts?.minutes],
    ["secs", parts?.seconds],
  ];

  return (
    <div className="grid grid-cols-4 gap-2" aria-live="off">
      {cells.map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-night-950/60 py-2 text-center ring-1 ring-white/10">
          <div className="font-display text-4xl tabular-nums leading-none text-beer-300">
            {value === undefined ? "–" : String(value).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[0.7rem] font-semibold uppercase tracking-widest text-night-300">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
