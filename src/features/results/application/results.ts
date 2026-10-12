import type { Matchday, MatchdaysGateway } from "../../matchdays/domain/matchdays";
import { visibleMatchdays } from "../../matchdays/domain/matchdays";
import type { Escrutinio, LosillaJornada, MatchdayResults, ResultsGateway } from "../domain/results";
import { ServiceError } from "../../../lib/http/errors";

/** Matchdays whose results page makes sense: everything except drafts (not open yet) and soft-deleted ones. */
export async function listResultMatchdays(gateway: MatchdaysGateway, limit = 20): Promise<Matchday[]> {
  return visibleMatchdays(await gateway.list({ limit }));
}

const validNumber = (value: number) => Number.isSafeInteger(value) && value >= 1;

export async function getMatchResults(gateway: ResultsGateway, matchday: Pick<Matchday, "season" | "number">): Promise<MatchdayResults> {
  if (!validNumber(matchday.season) || !validNumber(matchday.number)) throw new ServiceError("not-found");
  return gateway.getMatches(matchday.season, matchday.number);
}

export async function getEscrutinio(gateway: ResultsGateway, matchday: Pick<Matchday, "season" | "number">): Promise<Escrutinio | null> {
  if (!validNumber(matchday.season) || !validNumber(matchday.number)) throw new ServiceError("not-found");
  return gateway.getEscrutinio(matchday.season, matchday.number);
}

/** Losilla's season is the end-year ("2027" for 2026/27); the backend stores the start-year. */
export const losillaSeasonOf = (season: number): number => season + 1;

export async function getLosillaJornada(gateway: ResultsGateway, matchday: Pick<Matchday, "season" | "number">): Promise<LosillaJornada | null> {
  if (!validNumber(matchday.season) || !validNumber(matchday.number)) throw new ServiceError("not-found");
  return gateway.getJornada(losillaSeasonOf(matchday.season), matchday.number);
}
