"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "beer" | "fine" | "letoff" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  beer: "bg-beer-400 text-ink shadow-[0_6px_0_0_var(--color-beer-700)] active:shadow-[0_2px_0_0_var(--color-beer-700)]",
  fine: "bg-fine-500 text-white shadow-[0_6px_0_0_var(--color-fine-700)] active:shadow-[0_2px_0_0_var(--color-fine-700)]",
  letoff:
    "bg-letoff-500 text-ink shadow-[0_6px_0_0_var(--color-letoff-700)] active:shadow-[0_2px_0_0_var(--color-letoff-700)]",
  ghost: "bg-white/8 text-foam ring-1 ring-white/15 shadow-[0_4px_0_0_rgb(0_0_0/0.35)] active:shadow-none",
  danger: "bg-transparent text-fine-400 ring-2 ring-fine-500/60 active:bg-fine-500/10",
};

const sizes: Record<Size, string> = {
  sm: "h-10 rounded-xl px-3.5 text-sm",
  md: "h-12 rounded-2xl px-5 text-base",
  lg: "h-16 rounded-[1.25rem] px-6 font-display text-2xl tracking-wide",
};

export function Button({
  variant = "beer",
  size = "md",
  className = "",
  busy = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex select-none items-center justify-center gap-2 font-semibold transition active:translate-y-[3px] disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[1.75rem] bg-night-800/85 p-5 shadow-[0_14px_40px_-16px_rgb(0_0_0/0.8)] ring-1 ring-white/10 backdrop-blur ${className}`}
    >
      {children}
    </section>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-3 text-left disabled:opacity-50"
    >
      <span>
        <span className="block font-semibold">{label}</span>
        {hint ? <span className="block text-sm text-night-300">{hint}</span> : null}
      </span>
      <span
        aria-hidden
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? "bg-letoff-500" : "bg-night-600"}`}
      >
        <span
          className={`absolute top-1 size-6 rounded-full bg-foam shadow transition-all ${checked ? "left-7" : "left-1"}`}
        />
      </span>
    </button>
  );
}

// A bottom sheet, which is easier to reach one-handed than a centred modal.
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-[2rem] bg-night-900 p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] ring-1 ring-white/10"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
        <h2 className="mb-3 font-display text-2xl tracking-wide">{title}</h2>
        {children}
      </div>
    </div>
  );
}
