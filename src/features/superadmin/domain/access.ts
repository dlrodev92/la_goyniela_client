/** Outcome of the cheap admin probe (`GET /api/v1/admin/users?limit=1`). `unavailable`: anything but a clear yes/no. */
export type AdminProbe = "granted" | "denied" | "unavailable";

/**
 * The live `UserOut` does not carry `is_superadmin` yet, so a user is a superadmin when the flag says so OR the admin
 * probe succeeded. 401/403 on the probe mean "not a superadmin"; an unavailable probe never grants access.
 */
export function decideSuperadmin(input: { isSuperadmin: boolean; probe: AdminProbe | null }): boolean {
  if (input.isSuperadmin === true) return true;
  return input.probe === "granted";
}

/** The flag alone settles the question only when it is true: otherwise the probe must run. */
export const needsProbe = (isSuperadmin: boolean): boolean => isSuperadmin !== true;
