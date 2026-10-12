import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "../../auth/server/session";
import { decideSuperadmin, needsProbe, type AdminProbe } from "../domain/access";
import { adminGateway } from "./gateway";
import { ServiceError } from "../../../lib/http/errors";

type Access = { allowed: boolean; error: ServiceError | null };

/**
 * Superadmin gate, once per request. The flag on the user settles it when true; otherwise one cheap probe
 * (`GET /api/v1/admin/users?limit=1`) decides, because the live `UserOut` does not carry `is_superadmin` yet.
 * 401/403 mean "not a superadmin"; any other failure (429, network) never grants access and is kept so pages can show it.
 */
export const superadminAccess = cache(async (): Promise<Access> => {
  const user = await requireUser();
  let probe: AdminProbe | null = null;
  let error: ServiceError | null = null;
  if (needsProbe(user.isSuperadmin)) {
    try {
      await (await adminGateway()).listUsers({ onlySuperadmins: false, limit: 1, offset: 0 });
      probe = "granted";
    } catch (caught) {
      if (!(caught instanceof ServiceError)) throw caught;
      if (caught.code === "forbidden" || caught.code === "unauthenticated") probe = "denied";
      else { probe = "unavailable"; error = caught; }
    }
  }
  return { allowed: decideSuperadmin({ isSuperadmin: user.isSuperadmin, probe }), error };
});

/** True for superadmins; never throws on a failed probe (used to decide whether to show the entry point). */
export async function isSuperadmin(): Promise<boolean> {
  return (await superadminAccess()).allowed;
}

/** Every /superadmin page: non-superadmins get the standard not-found page; a failed probe surfaces its error. */
export async function requireSuperadmin(): Promise<void> {
  const access = await superadminAccess();
  if (access.allowed) return;
  if (access.error) throw access.error;
  notFound();
}
