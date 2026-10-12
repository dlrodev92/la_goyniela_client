import { ServiceError, type FailureCode } from "../../../lib/http/errors";

export type AdminOperation =
  | "user-patch" | "team-create" | "team-patch" | "team-delete" | "team-restore" | "logo"
  | "jornada-patch" | "jornada-transition" | "jornada-delete" | "composicion-patch" | "ingest" | "read";

/**
 * HTTP status -> failure code per operation, handed to the json client as `statusMap`. Only the statuses whose meaning
 * depends on the operation (400, 409, 422, plus the logo upload statuses) are listed; 401/403/404/429 keep the shared
 * mapping (unauthenticated / forbidden / not-found / rate-limit with Retry-After).
 */
export function adminStatusMap(operation: AdminOperation): Partial<Record<number, FailureCode>> {
  switch (operation) {
    case "user-patch": return { 400: "last-superadmin", 422: "admin-invalid" };
    case "team-create": return { 400: "admin-invalid", 409: "team-duplicate", 422: "admin-invalid" };
    case "team-patch": return { 400: "admin-invalid", 409: "team-duplicate", 422: "admin-invalid" };
    case "team-delete": return { 409: "team-in-use" };
    case "logo": return { 400: "invalid-image", 415: "invalid-image", 422: "invalid-image", 413: "file-too-large" };
    case "jornada-patch": case "jornada-transition": return { 400: "invalid-transition", 422: "admin-invalid" };
    case "composicion-patch": return { 400: "invalid-team-ref", 422: "admin-invalid" };
    case "ingest": return { 400: "admin-invalid", 422: "admin-invalid" };
    default: return {};
  }
}

/** Spanish copy for a failure of an admin operation. Never the backend `detail`. */
export function adminErrorCopy(code: FailureCode, retryAfterSeconds: number | null = null): string {
  return new ServiceError(code, { retryAfterSeconds }).message;
}
