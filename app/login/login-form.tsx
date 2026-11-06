"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { signIn, type LoginState } from "./actions";

const field =
  "h-14 w-full rounded-2xl bg-night-900 px-4 text-base text-foam ring-1 ring-white/15 placeholder:text-night-400 focus:outline-none focus:ring-2 focus:ring-beer-400";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form
      action={action}
      key={state.attempt ?? 0}
      className={`space-y-4 ${state.error ? "animate-shake" : ""}`}
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-night-300">Username</span>
        <input
          name="username"
          defaultValue={state.username}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className={field}
          placeholder="e.g. sam"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-night-300">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
          placeholder="The one the host gave you"
        />
      </label>

      {state.error ? (
        <p role="alert" className="rounded-2xl bg-fine-500/15 px-4 py-3 text-sm text-fine-400 ring-1 ring-fine-500/40">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" busy={pending}>
        Let me in
      </Button>
    </form>
  );
}
