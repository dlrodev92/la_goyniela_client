import type { Matchday, MatchdayDetail, MatchdayFilter, MatchdaysGateway } from "../domain/matchdays";
import { isVisibleMatchday, visibleMatchdays } from "../domain/matchdays";
import { ServiceError } from "../../../lib/http/errors";
import { isRouteId } from "../../../lib/route-id";

/** The matchdays a regular user may see: the backend still serves drafts and soft-deleted rows, so they are dropped here. */
export async function listMatchdays(gateway: MatchdaysGateway, filter?: MatchdayFilter): Promise<Matchday[]> {
  return visibleMatchdays(await gateway.list(filter));
}

/** The first active matchday, if any. Prefer listing every active one (several can overlap); this is kept for single-jornada callers. */
export async function findActiveMatchday(gateway: MatchdaysGateway): Promise<Matchday | null> {
  const [active] = visibleMatchdays(await gateway.list({ status: "active", limit: 1 }));
  return active ?? null;
}

/** A draft or soft-deleted matchday is "not found" for regular users, exactly as if it did not exist. */
export async function getMatchday(gateway: MatchdaysGateway, matchdayId: string): Promise<MatchdayDetail> {
  if (!isRouteId(matchdayId)) throw new ServiceError("not-found");
  const detail = await gateway.get(matchdayId);
  if (!isVisibleMatchday(detail)) throw new ServiceError("not-found");
  return detail;
}
