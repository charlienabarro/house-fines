// Public Supabase settings. The literal process.env.NEXT_PUBLIC_* reads are
// needed so Next.js can inline them into the browser bundle.
//
// Supports both the new key name (publishable) and the older one (anon),
// which is also what Vercel's Supabase integration injects.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase isn't configured. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url, key };
}

// Usernames map to placeholder emails for Supabase Auth. Server-only.
export function usernameToEmail(username: string) {
  const domain = (process.env.MEMBER_EMAIL_DOMAIN ?? "housefines.local").toLowerCase();
  return `${username}@${domain}`;
}
