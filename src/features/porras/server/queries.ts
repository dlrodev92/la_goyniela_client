import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getPorra, getPropuesta, listPorras, loadBoleto, loadMyPicks } from "../application/porras";
import { porrasGateway } from "./gateway";
import { withSession } from "../../shared/server/authenticated-api";
import { ServiceError } from "../../../lib/http/errors";
import { isRouteId } from "../../../lib/route-id";

/** One porra of a group. Unknown ids render not-found; a non-member (403 "not a member of this group") goes to /forbidden. */
export const loadPorra = cache(async (groupId: string, porraId: string) => {
  if (!isRouteId(groupId) || !isRouteId(porraId)) notFound();
  try {
    return await withSession(async () => getPorra(await porrasGateway(), groupId, porraId));
  } catch (error) {
    if (error instanceof ServiceError && error.code === "not-found") notFound();
    if (error instanceof ServiceError && error.code === "forbidden") redirect("/forbidden");
    throw error;
  }
});

/** Porras of a group, optionally for one jornada. Backend failures bubble as ServiceError. */
export const loadGroupPorras = cache(async (groupId: string, jornadaId?: string) =>
  withSession(async () => listPorras(await porrasGateway(), groupId, jornadaId)));

/** The caller's saved picks for a porra, or null when none were sent yet. */
export const loadMyPorraPicks = cache(async (groupId: string, porraId: string) =>
  withSession(async () => loadMyPicks(await porrasGateway(), groupId, porraId)));

/** Everybody's participation (and picks when the group shows them). */
export const loadPorraPicks = cache(async (groupId: string, porraId: string) =>
  withSession(async () => (await porrasGateway()).listPicks(groupId, porraId)));

/** The official boleto of the peña, or null while the admin has not decided it. */
export const loadFinalBoleto = cache(async (groupId: string, porraId: string) =>
  withSession(async () => loadBoleto(await porrasGateway(), groupId, porraId)));

/** Every group's porras for one jornada, in parallel and capped: a user belongs to few groups. */
const GROUP_CAP = 12;
export const loadPorrasOfJornada = cache(async (groupIds: readonly string[], jornadaId: string) => {
  const capped = groupIds.slice(0, GROUP_CAP);
  const results = await Promise.all(capped.map(async groupId => {
    try { return { groupId, porras: await loadGroupPorras(groupId, jornadaId) }; }
    catch (error) {
      // A single failing group must not hide the others; control-flow errors still propagate.
      if (!(error instanceof ServiceError)) throw error;
      return { groupId, porras: [] };
    }
  }));
  return results.flatMap(({ groupId, porras }) => porras.filter(porra => porra.jornadaId === jornadaId).map(porra => ({ groupId, porra })));
});

/**
 * Every group's porras of any jornada with one request per group (the API's `jornada_id` filter is optional), instead of
 * groups x jornadas calls. Callers filter by jornada themselves. Same cap and failure isolation as `loadPorrasOfJornada`.
 */
export const loadPorrasOfGroups = cache(async (groupIds: readonly string[]) => {
  const results = await Promise.all(groupIds.slice(0, GROUP_CAP).map(async groupId => {
    try { return { groupId, porras: await loadGroupPorras(groupId) }; }
    catch (error) {
      if (!(error instanceof ServiceError)) throw error;
      return { groupId, porras: [] };
    }
  }));
  return results.flatMap(({ groupId, porras }) => porras.map(porra => ({ groupId, porra })));
});

/** Admin: the computed proposal (a POST that saves nothing). Backend failures bubble as ServiceError. */
export const loadPropuesta = cache(async (groupId: string, porraId: string) =>
  withSession(async () => getPropuesta(await porrasGateway(), groupId, porraId)));
