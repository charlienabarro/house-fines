"use server";

import { redirect } from "next/navigation";
import { usernameToEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; username?: string; attempt?: number };

const USERNAME = /^[a-z0-9][a-z0-9_.-]{1,31}$/;

export async function signIn(prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const attempt = (prev.attempt ?? 0) + 1;

  if (!username || !password) {
    return { error: "Enter your username and password.", username, attempt };
  }

  // Same message either way, so nobody can fish for usernames.
  const wrong = {
    error: "That username and password don't match. Ask the host if you're stuck.",
    username,
    attempt,
  };
  if (!USERNAME.test(username)) return wrong;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    if (error.status === 429) {
      return { error: "Too many attempts. Have a glass of water and try again in a minute.", username, attempt };
    }
    return wrong;
  }

  redirect("/");
}
