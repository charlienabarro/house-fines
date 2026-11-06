import { signOut } from "@/app/actions";

// Signed in to Supabase, but not on the house list (e.g. made by hand in the
// dashboard without running the seed script).
export function NotAMember() {
  return (
    <div className="space-y-4 rounded-[1.75rem] bg-night-800/85 p-6 text-center ring-1 ring-white/10">
      <p className="text-5xl">🚪</p>
      <h1 className="font-display text-3xl">You&apos;re not on the list</h1>
      <p className="text-night-300">
        This account isn&apos;t set up as a housemate yet. Ask the host to add you with the seed
        script.
      </p>
      <form action={signOut}>
        <button type="submit" className="font-semibold text-beer-300 underline underline-offset-4">
          Sign out
        </button>
      </form>
    </div>
  );
}
