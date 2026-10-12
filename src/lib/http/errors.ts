export type FailureCode = "credentials" | "unauthenticated" | "validation" | "network" | "timeout" | "rate-limit" | "upstream" | "malformed" | "configuration" | "provider"
  | "forbidden" | "not-found" | "conflict" | "invalid-join-code" | "already-member" | "group-full" | "creator-cannot-leave"
  | "voting-closed" | "invalid-picks" | "email-taken" | "invalid-image" | "file-too-large"
  | "self-action" | "creator-protected" | "already-admin" | "not-admin"
  | "porra-exists" | "porra-closed" | "min-format" | "over-budget" | "format-mismatch" | "boleto-locked" | "invalid-porra"
  | "jornada-in-preparation" | "sale-not-opened" | "voting-window-closed" | "escrutinio-pending" | "escrutinio-disponible" | "provider-down"
  | "admin-invalid" | "last-superadmin" | "team-in-use" | "team-duplicate" | "invalid-transition" | "invalid-team-ref";

const messages: Record<FailureCode, string> = {
  credentials: "El correo o la contraseña no son correctos.",
  unauthenticated: "Tu sesión ha caducado. Inicia sesión de nuevo.",
  validation: "Revisa tu correo y tu contraseña e inténtalo de nuevo.",
  network: "No hemos podido conectar con el servicio. Inténtalo de nuevo.",
  timeout: "El servicio ha tardado demasiado en responder. Inténtalo de nuevo.",
  "rate-limit": "Demasiadas solicitudes. Espera un momento antes de volver a intentarlo.",
  upstream: "El servicio no está disponible por ahora. Inténtalo de nuevo.",
  malformed: "El servicio ha devuelto una respuesta inesperada. Inténtalo de nuevo.",
  provider: "No hemos podido iniciar sesión con ese proveedor. Inténtalo de nuevo.",
  forbidden: "No tienes permiso para hacer eso.",
  "not-found": "No hemos encontrado lo que buscabas.",
  conflict: "Esa acción entra en conflicto con el estado actual. Actualiza la página e inténtalo de nuevo.",
  "invalid-join-code": "Ninguna peña coincide con ese código. Revísalo e inténtalo de nuevo.",
  "already-member": "Ya eres miembro de esa peña.",
  "group-full": "Esa peña está completa y no admite más miembros.",
  "creator-cannot-leave": "El creador de una peña no puede abandonarla.",
  "jornada-in-preparation": "La jornada aún está en preparación.",
  "sale-not-opened": "La venta de esta jornada aún no ha abierto.",
  "voting-window-closed": "El plazo de votación ha terminado.",
  "escrutinio-pending": "La jornada ha terminado.",
  "escrutinio-disponible": "La jornada ha terminado.",
  "provider-down": "El servicio de inicio de sesión no está disponible por ahora. Inténtalo más tarde.",
  "voting-closed": "La votación de esta jornada está cerrada, así que no se han guardado tus pronósticos.",
  "invalid-picks": "Algunos de tus pronósticos no se han aceptado. Revísalos e inténtalo de nuevo.",
  "email-taken": "Ya existe una cuenta con ese correo.",
  "invalid-image": "Esa imagen no se ha aceptado. Usa una imagen PNG, JPEG o WebP.",
  "file-too-large": "Esa imagen es demasiado grande. El tamaño máximo es de 5 MB.",
  "self-action": "No puedes cambiar tu propio rol ni expulsarte. Para salir de la peña usa «Salir de la peña».",
  "creator-protected": "El creador de la peña no puede ser degradado ni expulsado, y solo los admins pueden gestionar miembros.",
  "already-admin": "Ese miembro ya es admin. Actualiza la página para ver los cambios.",
  "not-admin": "Ese miembro ya no es admin. Actualiza la página para ver los cambios.",
  "porra-exists": "Tu peña ya tiene una porra para esa jornada.",
  "porra-closed": "Esta porra está cerrada y ya no admite cambios.",
  "min-format": "El formato mínimo es de 2 columnas (1 doble o 1 triple).",
  "over-budget": "Ese formato cuesta más que el presupuesto de la porra.",
  "format-mismatch": "El boleto no respeta los dobles y triples de la porra. Revísalo e inténtalo de nuevo.",
  "boleto-locked": "La peña ya ha confirmado su boleto, así que el formato de la porra ya no se puede cambiar.",
  "invalid-porra": "Algunos datos de la porra no son válidos. Revísalos e inténtalo de nuevo.",
  "admin-invalid": "Algunos datos no son válidos. Revísalos e inténtalo de nuevo.",
  "last-superadmin": "No se puede quitar al último superadmin: promociona antes a otra persona.",
  "team-in-use": "No se puede eliminar: el equipo está en uso.",
  "team-duplicate": "Ya existe un equipo con ese identificador o con ese nombre en la misma competición.",
  "invalid-transition": "Esa acción no es válida para el estado actual de la jornada. Actualiza la página e inténtalo de nuevo.",
  "invalid-team-ref": "Alguno de los equipos elegidos no existe o está eliminado.",
  configuration: "El inicio de sesión aún no está configurado. Contacta con el administrador del sitio.",
};

/** Upper bound for a trusted `Retry-After`: anything longer is shown as this, never as an hour-long countdown. */
const RETRY_AFTER_MAX_SECONDS = 3600;

/**
 * Seconds to wait from a `Retry-After` header (delta-seconds or HTTP-date, RFC 9110 §10.2.3), clamped to 1..3600.
 * Null when the header is absent or unreadable. The clock is injectable so the date form stays deterministic in tests.
 */
export function parseRetryAfter(value: string | null | undefined, now: Date = new Date()): number | null {
  const raw = value?.trim();
  if (!raw) return null;
  let seconds: number;
  if (/^\d+$/.test(raw)) seconds = Number(raw);
  else {
    // An HTTP-date always names its weekday and month; this keeps Date.parse from reading "1.5" or "-5" as a date.
    if (!/[A-Za-z]{3}/.test(raw)) return null;
    const at = Date.parse(raw);
    if (Number.isNaN(at)) return null;
    seconds = Math.ceil((at - now.getTime()) / 1000);
  }
  return Math.min(Math.max(seconds, 1), RETRY_AFTER_MAX_SECONDS);
}

export const rateLimitMessage = (seconds: number | null): string =>
  seconds === null ? messages["rate-limit"] : `Demasiadas solicitudes, reinténtalo en ${seconds}s`;

export class ServiceError extends Error {
  readonly code: FailureCode;
  /** Only set with `rate-limit` when the backend sent a usable `Retry-After`: seconds to wait before trying again. */
  readonly retryAfterSeconds: number | null;
  /** Only set with `invalid-picks`: 1-based match numbers (15 = pleno) the backend flagged, in order. */
  readonly invalidMatches: readonly number[];
  /**
   * `message` overrides the default copy. It must be client-authored Spanish text, never backend `detail`.
   */
  constructor(code: FailureCode, extra: { invalidMatches?: readonly number[]; message?: string; retryAfterSeconds?: number | null } = {}) {
    const retryAfterSeconds = code === "rate-limit" ? extra.retryAfterSeconds ?? null : null;
    super(extra.message ?? (code === "rate-limit" ? rateLimitMessage(retryAfterSeconds) : messages[code]));
    this.retryAfterSeconds = retryAfterSeconds;
    this.invalidMatches = extra.invalidMatches ?? [];
    this.name = "ServiceError";
    this.code = code;
  }
}

export function safeMessage(error: unknown): string {
  return error instanceof ServiceError ? error.message : messages.upstream;
}
