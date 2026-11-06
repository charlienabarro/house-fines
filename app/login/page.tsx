import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-10 px-4 py-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo big />
        <p className="max-w-[18rem] text-night-300">
          Fines night awaits. Sign in with the username and password the host gave you.
        </p>
      </div>
      <LoginForm />
      <p className="text-center text-xs text-night-400">
        No account? There&apos;s no sign-up. The host sets everyone up.
      </p>
    </main>
  );
}
