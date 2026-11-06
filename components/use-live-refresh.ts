"use client";

import { useEffect, useEffectEvent } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Calls `onChange` whenever any of `tables` changes in the database, plus:
 * once on mount, whenever the phone wakes up or comes back online, and every
 * 30 seconds as a safety net (phones love dropping websockets).
 *
 * Realtime events are only used as a "something changed" nudge. The caller
 * re-reads what it needs, so a missed or out-of-order event can't leave the
 * screen in a weird state.
 */
export function useLiveRefresh(tables: readonly string[], onChange: () => void) {
  const notify = useEffectEvent(onChange);
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => notify(), 120);
    };

    const channel = supabase.channel(`house-${Math.random().toString(36).slice(2)}`);
    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, fire);
    }

    // Make sure realtime runs with the signed-in user's token, so RLS lets
    // the events through.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") fire();
      });
    });

    const onVisible = () => document.visibilityState === "visible" && fire();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", fire);
    const poll = setInterval(() => document.visibilityState === "visible" && fire(), 30_000);
    fire();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", fire);
      supabase.removeChannel(channel);
    };
  }, [key]);
}
