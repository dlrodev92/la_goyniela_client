import "server-only";
import { cache } from "react";
import { getEscrutinio, getLosillaJornada, getMatchResults, listResultMatchdays } from "../application/results";
import { resultsGateway } from "./gateway";
import { matchdaysGateway } from "../../matchdays/server/gateway";
import type { Matchday } from "../../matchdays/domain/matchdays";
import type { Escrutinio, LosillaJornada, MatchdayResults } from "../domain/results";
import { withSession } from "../../shared/server/authenticated-api";
import { ServiceError } from "../../../lib/http/errors";

export const loadResultMatchdays = cache(async () => withSession(async () => listResultMatchdays(await matchdaysGateway())));

/** What a results section shows: data, "not published yet" (404/204) or "service unavailable" (anything else). */
export type Section<T> = { status: "ready"; data: T } | { status: "not-published" } | { status: "unavailable" };

async function section<T>(load: () => Promise<T | null>): Promise<Section<T>> {
  try {
    const data = await withSession(load);
    return data === null ? { status: "not-published" } : { status: "ready", data };
  } catch (error) {
    // Control-flow errors (redirect) and bugs propagate; provider outages and timeouts degrade the section.
    if (!(error instanceof ServiceError)) throw error;
    return error.code === "not-found" ? { status: "not-published" } : { status: "unavailable" };
  }
}

export const loadMatchResults = cache(async (matchday: Pick<Matchday, "season" | "number">): Promise<Section<MatchdayResults>> =>
  section(async () => getMatchResults(await resultsGateway(), matchday)));

export const loadEscrutinio = cache(async (matchday: Pick<Matchday, "season" | "number">): Promise<Section<Escrutinio>> =>
  section(async () => getEscrutinio(await resultsGateway(), matchday)));

export const loadLosillaJornada = cache(async (matchday: Pick<Matchday, "season" | "number">): Promise<Section<LosillaJornada>> =>
  section(async () => getLosillaJornada(await resultsGateway(), matchday)));
