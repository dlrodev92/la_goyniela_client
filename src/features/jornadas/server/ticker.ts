import "server-only";
import { cache } from "react";
import { getMatchday, listMatchdays } from "../../matchdays/application/matchdays";
import { matchdaysGateway } from "../../matchdays/server/gateway";
import { getLosillaJornada } from "../../results/application/results";
import type { LosillaMatch } from "../../results/domain/results";
import { resultsGateway } from "../../results/server/gateway";
import { ServiceError } from "../../../lib/http/errors";
import { buildTickerChips, pickNextActiveMatchday, type TickerChip } from "../domain/ticker";

export type TickerData = { matchdayId: string; number: number; chips: TickerChip[] };

/**
 * Data of the next-jornada ticker, or null when there is nothing to show (no active jornada, no fixtures, backend down).
 * Purely decorative: every service failure degrades to "no ticker", and Losilla is optional (the fixtures alone suffice).
 * Deliberately not wrapped in `withSession`: an expired session is handled by the page the user is on, not by this strip.
 */
export const loadTicker = cache(async (): Promise<TickerData | null> => {
  try {
    const gateway = await matchdaysGateway();
    const next = pickNextActiveMatchday(await listMatchdays(gateway, { status: "active", limit: 20 }));
    if (!next) return null;
    const detail = await getMatchday(gateway, next.id);
    if (detail.fixtures.length === 0) return null;
    let losilla: LosillaMatch[] = [];
    try {
      losilla = (await getLosillaJornada(await resultsGateway(), detail))?.matches ?? [];
    } catch (error) {
      if (!(error instanceof ServiceError)) throw error;
    }
    return { matchdayId: detail.id, number: detail.number, chips: buildTickerChips(detail.fixtures, losilla) };
  } catch (error) {
    if (error instanceof ServiceError) return null;
    throw error;
  }
});
