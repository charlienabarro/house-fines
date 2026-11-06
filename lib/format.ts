// Everything is shown in UK time, whatever timezone a phone is set to.
const TZ = "Europe/London";

const deadlineFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

const weekFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TZ,
});

const shortDayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: TZ,
});

/** "Friday 13 November at 18:00" */
export const formatDeadline = (iso: string) => deadlineFormat.format(new Date(iso));
/** "Fri 13 Nov 2026" */
export const formatWeek = (iso: string) => weekFormat.format(new Date(iso));
/** "Fri 13 Nov" */
export const formatShortDay = (iso: string) => shortDayFormat.format(new Date(iso));

export function splitSeconds(total: number) {
  const s = Math.max(0, Math.floor(total));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/** plural(3, "motion") -> "3 motions" */
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
