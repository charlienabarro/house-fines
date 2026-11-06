export function Logo({ big = false }: { big?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${big ? "flex-col gap-3" : ""}`}>
      <span
        aria-hidden
        className={`inline-grid place-items-center rounded-2xl bg-beer-400 shadow-[0_4px_0_0_var(--color-beer-700)] ${
          big ? "size-20 rotate-[-6deg] animate-wobble text-5xl" : "size-9 rotate-[-6deg] text-xl"
        }`}
      >
        🍺
      </span>
      <span
        className={`font-display leading-none tracking-wide text-foam ${big ? "text-5xl" : "text-2xl"}`}
      >
        House <span className="text-beer-400">Fines</span>
      </span>
    </span>
  );
}
