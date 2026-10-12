import type { Matchday, MatchdayStatus } from "../../matchdays/domain/matchdays";
import { visibleMatchdays } from "../../matchdays/domain/matchdays";
import type { LosillaMatch } from "../../results/domain/results";
import { formatDateTime } from "../../../lib/format-date";

/** URL value of the `estado` query parameter -> matchday status. Drafts are never offered: regular users cannot see them. */
export const STATUS_FILTERS = [
  { status: "active", label: "Abiertas" },
  { status: "past", label: "Finalizadas" },
] as const satisfies readonly { status: MatchdayStatus; label: string }[];

export function parseStatusFilter(value: string | string[] | undefined): MatchdayStatus | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return STATUS_FILTERS.find(filter => filter.status === raw)?.status ?? null;
}

/** Active first, then the rest by season and number, newest first. Pure: returns a new array. */
export function sortMatchdays(matchdays: readonly Matchday[]): Matchday[] {
  const rank = (matchday: Matchday) => (matchday.status === "active" ? 0 : 1);
  return [...matchdays].sort((a, b) => rank(a) - rank(b) || b.season - a.season || b.number - a.number);
}

export function filterMatchdays(matchdays: readonly Matchday[], status: MatchdayStatus | null): Matchday[] {
  const visible = visibleMatchdays(matchdays);
  return sortMatchdays(status ? visible.filter(matchday => matchday.status === status) : visible);
}

/** The date that matters most for a card: voting deadline, else first kickoff; labelled for the reader. */
export function keyDateOf(matchday: Pick<Matchday, "votingClosesAt" | "firstKickoffAt">): { label: string; value: string } | null {
  const closes = formatDateTime(matchday.votingClosesAt);
  if (closes) return { label: "Cierre de votación", value: closes };
  const kickoff = formatDateTime(matchday.firstKickoffAt);
  return kickoff ? { label: "Primer partido", value: kickoff } : null;
}

const DAYS: Record<string, string> = { LUN: "Lun", MAR: "Mar", MIE: "Mié", JUE: "Jue", VIE: "Vie", SAB: "Sáb", DOM: "Dom" };

export function dayLabel(day: string): string {
  const key = day.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().slice(0, 3);
  return DAYS[key] ?? day;
}

/** Schedule line of a match: Losilla "Sáb 14:00" when published, else the fixture kickoff, else null. */
export function scheduleLabel(losilla: Pick<LosillaMatch, "day" | "time"> | undefined, kickoffAt: string | null): string | null {
  const parts = [losilla?.day ? dayLabel(losilla.day) : null, losilla?.time ?? null].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" ") : formatDateTime(kickoffAt);
}
