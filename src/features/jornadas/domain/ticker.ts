import type { Fixture, Matchday } from "../../matchdays/domain/matchdays";
import { isVisibleMatchday } from "../../matchdays/domain/matchdays";
import type { LosillaMatch } from "../../results/domain/results";
import { kickoffLabelOf } from "./calendar";
import { dayLabel } from "./jornadas";

type Candidate = Pick<Matchday, "status" | "firstKickoffAt" | "number" | "season" | "deletedAt">;

/**
 * The jornada the ticker follows: the active one with the earliest first kickoff. Undated ones come after the dated
 * ones; ties and undated ones are broken by the lowest number. Null when nothing is active.
 */
export function pickNextActiveMatchday<T extends Candidate>(matchdays: readonly T[]): T | null {
  const time = (matchday: T) => {
    const parsed = matchday.firstKickoffAt ? Date.parse(matchday.firstKickoffAt) : Number.NaN;
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  };
  const active = matchdays.filter(matchday => isVisibleMatchday(matchday) && matchday.status === "active");
  active.sort((a, b) => {
    const left = time(a);
    const right = time(b);
    if (left !== right) return left < right ? -1 : 1;
    return a.number - b.number || a.season - b.season;
  });
  return active[0] ?? null;
}

export type TickerChip = {
  position: number;
  /** Text of the left slot: the played score ("2-1"), else the schedule ("SÁB 14:00"), else null. */
  label: string | null;
  played: boolean;
  homeName: string;
  awayName: string;
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
};

const upper = (value: string) => value.toLocaleUpperCase("es-ES");

function scheduleOf(fixture: Pick<Fixture, "kickoffAt">, losilla: LosillaMatch | undefined): string | null {
  const kickoff = kickoffLabelOf(fixture.kickoffAt);
  if (kickoff) return kickoff;
  const parts = [losilla?.day ? upper(dayLabel(losilla.day)) : null, losilla?.time ?? null].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** One chip per fixture, in order. Short names come from Losilla, then the team, then the raw fixture name. */
export function buildTickerChips(fixtures: readonly Fixture[], losilla: readonly LosillaMatch[]): TickerChip[] {
  const byPosition = new Map(losilla.map(match => [match.position, match]));
  return [...fixtures].sort((a, b) => a.position - b.position).map(fixture => {
    const extra = byPosition.get(fixture.position);
    const score = extra?.score ?? null;
    return {
      position: fixture.position,
      label: score ? `${score.home}-${score.away}` : scheduleOf(fixture, extra),
      played: score !== null,
      homeName: upper(extra?.homeShort ?? fixture.homeShortName ?? fixture.home),
      awayName: upper(extra?.awayShort ?? fixture.awayShortName ?? fixture.away),
      homeLogoUrl: fixture.homeLogoUrl,
      awayLogoUrl: fixture.awayLogoUrl,
    };
  });
}
