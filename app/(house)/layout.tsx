import type { ReactNode } from "react";
import { Header } from "@/components/header";

export default function HouseLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <Header />
      <main className="flex-1">{children}</main>
    </div>
  );
}
