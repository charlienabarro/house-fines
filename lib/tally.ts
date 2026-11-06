import type { Member } from "@/lib/types";

export interface TallyRow {
  id: string;
  name: string;
  fines: number;
  rank: number;
}

/** Count passed motions per person, most fined first. Ties share a rank. */
export function buildTally(
  motions: { accused_id: string; status: string }[],
  members: Member[],
): TallyRow[] {
  const counts = new Map<string, number>();
  for (const m of motions) {
    if (m.status === "passed") counts.set(m.accused_id, (counts.get(m.accused_id) ?? 0) + 1);
  }
  const rows = members
    .filter((m) => counts.has(m.id))
    .map((m) => ({ id: m.id, name: m.display_name, fines: counts.get(m.id) ?? 0, rank: 0 }))
    .sort((a, b) => b.fines - a.fines || a.name.localeCompare(b.name));
  for (const row of rows) row.rank = 1 + rows.filter((r) => r.fines > row.fines).length;
  return rows;
}

/** Everyone tied for the most fines. */
export function topOf(tally: TallyRow[]) {
  const best = tally[0]?.fines ?? 0;
  return { fines: best, names: tally.filter((r) => r.fines === best).map((r) => r.name) };
}

/** "Sam", "Sam & Priya", "Sam, Priya & Tom" */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}
