import type { Matchday } from "../../matchdays/domain/matchdays";
import { isVisibleMatchday } from "../../matchdays/domain/matchdays";

/** Copy of a card whose jornada has neither a first kickoff nor a voting deadline yet. */
export const DATE_TO_CONFIRM = "Fecha por confirmar";

export type CalendarDay = {
  /** Short weekday, uppercase: "SÁB". */
  weekday: string;
  /** Day of the month without padding: "10". */
  day: string;
  /** Short month, uppercase, three letters: "OCT". */
  month: string;
};

// Fixed Madrid time keeps server renders deterministic; the quiniela is a Spanish product.
const partsFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Madrid" });

const clean = (value: string) => value.replace(/\./g, "").trim().toLocaleUpperCase("es-ES");

/** Weekday, day and month of an instant in Europe/Madrid, or null when it is missing or not a date. */
export function calendarDayOf(iso: string | null): CalendarDay | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Map(partsFormatter.formatToParts(date).map(part => [part.type, part.value]));
  const weekday = parts.get("weekday");
  const day = parts.get("day");
  const month = parts.get("month");
  if (!weekday || !day || !month) return null;
  return { weekday: clean(weekday), day, month: clean(month).slice(0, 3) };
}

/** The instant a calendar card is dated by: first kickoff, else the voting deadline, else nothing. */
export function calendarInstantOf(matchday: Pick<Matchday, "firstKickoffAt" | "votingClosesAt">): string | null {
  for (const candidate of [matchday.firstKickoffAt, matchday.votingClosesAt]) {
    if (candidate && !Number.isNaN(Date.parse(candidate))) return candidate;
  }
  return null;
}

export function calendarDayOfMatchday(matchday: Pick<Matchday, "firstKickoffAt" | "votingClosesAt">): CalendarDay | null {
  return calendarDayOf(calendarInstantOf(matchday));
}

/**
 * Visible matchdays split for the jornadas page. `upcoming` are the active ones, soonest date first (undated last,
 * lowest number first); `past` is history, newest first. Drafts and soft-deleted rows are dropped.
 */
export function splitForCalendar<T extends Matchday>(matchdays: readonly T[]): { upcoming: T[]; past: T[] } {
  const visible = matchdays.filter(isVisibleMatchday);
  const time = (matchday: T) => {
    const instant = calendarInstantOf(matchday);
    return instant ? Date.parse(instant) : Number.POSITIVE_INFINITY;
  };
  const upcoming = visible
    .filter(matchday => matchday.status === "active")
    .sort((a, b) => {
      const left = time(a);
      const right = time(b);
      if (left === right) return a.number - b.number;
      return left < right ? -1 : 1;
    });
  const past = visible.filter(matchday => matchday.status === "past").sort((a, b) => b.season - a.season || b.number - a.number);
  return { upcoming, past };
}

const timeFormatter = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Madrid" });

/** "SÁB 14:00" in Madrid time, or null when the instant is missing or not a date. */
export function kickoffLabelOf(iso: string | null): string | null {
  const day = calendarDayOf(iso);
  if (!iso || !day) return null;
  return `${day.weekday} ${timeFormatter.format(new Date(iso))}`;
}
