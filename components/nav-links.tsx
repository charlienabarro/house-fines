"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Tonight" },
  { href: "/history", label: "History" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
      {links.map((link) => {
        const active = link.href === "/" ? path === "/" : path.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              active ? "bg-beer-400 text-ink" : "text-night-300 hover:text-foam"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
