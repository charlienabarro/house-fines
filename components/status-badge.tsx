import type { MotionStatus } from "@/lib/types";

const styles: Record<MotionStatus, [string, string]> = {
  passed: ["Fined", "bg-fine-500 text-white"],
  failed: ["Let off", "bg-letoff-500 text-ink"],
  skipped: ["Skipped", "bg-white/15 text-night-300"],
  pending: ["Not heard", "bg-white/10 text-night-400"],
  active: ["Live", "bg-beer-400 text-ink"],
};

export function StatusBadge({ status }: { status: MotionStatus }) {
  const [label, style] = styles[status];
  return (
    <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}
