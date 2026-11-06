import Link from "next/link";
import { signOut } from "@/app/actions";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";

export function Header() {
  return (
    <header className="mb-5 flex items-center justify-between gap-3">
      <Link href="/" aria-label="House Fines home" className="shrink-0">
        <Logo />
      </Link>
      <div className="flex items-center gap-1.5">
        <NavLinks />
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="grid size-10 place-items-center rounded-xl text-night-300 ring-1 ring-white/10 transition hover:text-foam active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </header>
  );
}
