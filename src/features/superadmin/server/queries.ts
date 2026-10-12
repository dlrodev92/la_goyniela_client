import "server-only";
import { cache } from "react";
import { requireSuperadmin } from "./access";
import { adminGateway } from "./gateway";
import { withSession } from "../../shared/server/authenticated-api";
import {
  ADMIN_PAGE_SIZE, paginate, type AdminJornada, type AdminTeam, type AdminUser,
} from "../domain/admin";
import type { AdminJornadaStatus } from "../domain/jornadas";
import { ServiceError, safeMessage } from "../../../lib/http/errors";
import { isRouteId } from "../../../lib/route-id";

/** A load that failed with a known, user-presentable cause (rate limit, upstream down...) instead of throwing. */
export type Loaded<T> = { ok: true; data: T } | { ok: false; message: string; rateLimited: boolean };

async function attempt<T>(call: () => Promise<T>): Promise<Loaded<T>> {
  await requireSuperadmin();
  try {
    return { ok: true, data: await withSession(call) };
  } catch (error) {
    if (!(error instanceof ServiceError) || error.code === "not-found") throw error;
    return { ok: false, message: safeMessage(error), rateLimited: error.code === "rate-limit" };
  }
}

const offsetOf = (page: number) => (page - 1) * ADMIN_PAGE_SIZE;

export const loadAdminUsers = cache(async (onlySuperadmins: boolean, page: number): Promise<Loaded<{ items: AdminUser[]; hasNext: boolean }>> =>
  attempt(async () => paginate(await (await adminGateway()).listUsers({ onlySuperadmins, limit: ADMIN_PAGE_SIZE + 1, offset: offsetOf(page) }), ADMIN_PAGE_SIZE)));

export const loadAdminTeams = cache(async (includeDeleted: boolean, page: number): Promise<Loaded<{ items: AdminTeam[]; hasNext: boolean }>> =>
  attempt(async () => paginate(await (await adminGateway()).listTeams({ includeDeleted, limit: ADMIN_PAGE_SIZE + 1, offset: offsetOf(page) }), ADMIN_PAGE_SIZE)));

export const loadAdminJornadas = cache(async (includeDeleted: boolean, status: AdminJornadaStatus | null, page: number): Promise<Loaded<{ items: AdminJornada[]; hasNext: boolean }>> =>
  attempt(async () => paginate(await (await adminGateway()).listJornadas({ includeDeleted, status, limit: ADMIN_PAGE_SIZE + 1, offset: offsetOf(page) }), ADMIN_PAGE_SIZE)));

/** One jornada by id for the `?abrir=` deep link, when it is not on the loaded page. Null when it does not exist or cannot be read. */
export const loadPinnedJornada = cache(async (jornadaId: string): Promise<AdminJornada | null> => {
  if (!isRouteId(jornadaId)) return null;
  try {
    const result = await attempt(async () => (await adminGateway()).getJornada(jornadaId));
    return result.ok ? result.data : null;
  } catch (error) {
    if (error instanceof ServiceError && error.code === "not-found") return null;
    throw error;
  }
});
