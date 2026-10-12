import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getMatchday, listMatchdays } from "../application/matchdays";
import { matchdaysGateway } from "./gateway";
import { withSession } from "../../shared/server/authenticated-api";
import { ServiceError } from "../../../lib/http/errors";
import { isRouteId } from "../../../lib/route-id";

/** One matchday with its fixtures; unknown or malformed ids render the standard not-found page. */
export const loadMatchday = cache(async (matchdayId: string) => {
  if (!isRouteId(matchdayId)) notFound();
  try {
    return await withSession(async () => getMatchday(await matchdaysGateway(), matchdayId));
  } catch (error) {
    if (error instanceof ServiceError && error.code === "not-found") notFound();
    throw error;
  }
});

/** Every matchday the backend serves (API page cap is 200), any status. */
export const loadAllMatchdays = cache(async () => withSession(async () => listMatchdays(await matchdaysGateway(), { limit: 200 })));

/** Every active matchday (normally one, but several can overlap): callers iterate them all instead of taking the first. */
export const loadActiveMatchdays = cache(async () => withSession(async () => listMatchdays(await matchdaysGateway(), { status: "active", limit: 20 })));
