// A pint glass that keeps filling up. Pure CSS, works in Server Components.
export function PintLoader({ label = "Pouring…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16" role="status">
      <div className="relative h-24 w-16">
        <div className="absolute inset-0 overflow-hidden rounded-b-2xl rounded-t-md border-4 border-foam/80">
          <div className="absolute inset-x-0 bottom-0 animate-fill bg-beer-400">
            <div className="absolute -top-2 inset-x-0 h-3 rounded-full bg-foam" />
            <span className="absolute bottom-1 left-3 size-1.5 animate-bubble rounded-full bg-foam/80" />
            <span className="absolute bottom-2 left-7 size-1 animate-bubble rounded-full bg-foam/80 [animation-delay:0.6s]" />
            <span className="absolute bottom-1 left-10 size-1.5 animate-bubble rounded-full bg-foam/80 [animation-delay:1.1s]" />
          </div>
        </div>
        <div className="absolute -right-4 top-6 h-10 w-5 rounded-r-xl border-4 border-l-0 border-foam/80" />
      </div>
      <p className="text-night-300">{label}</p>
    </div>
  );
}
