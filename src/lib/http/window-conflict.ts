import { ServiceError, type FailureCode } from "./errors";
import { formatDateTime } from "../format-date";

/** What the caller was trying to do when the jornada window refused it; it only picks the wording. */
export type WindowContext = "porra" | "picks" | "boleto";

/** `detail.code` of a window 409 -> client failure code. */
const BY_CODE: Record<string, FailureCode> = {
  jornada_in_preparation: "jornada-in-preparation",
  sale_not_yet_opened: "sale-not-opened",
  voting_window_closed: "voting-window-closed",
  escrutinio_pending: "escrutinio-pending",
  escrutinio_disponible: "escrutinio-disponible",
};

/** `detail.effective_phase` -> failure code, for builds that send the phase without a known `code`. */
const BY_PHASE: Record<string, FailureCode> = {
  en_preparacion: "jornada-in-preparation",
  lista_abre_pronto: "sale-not-opened",
  fuera_de_ventana: "voting-window-closed",
  escrutinio_pendiente: "escrutinio-pending",
  escrutinio_disponible: "escrutinio-disponible",
};

const asRecord = (detail: unknown): Record<string, unknown> | null =>
  typeof detail === "object" && detail !== null && !Array.isArray(detail) ? (detail as Record<string, unknown>) : null;

/** The failure a structured window refusal stands for (its `code`, else its `effective_phase`); undefined for anything else. */
export function windowFailureCode(detail: unknown): FailureCode | undefined {
  const record = asRecord(detail);
  if (!record) return undefined;
  if (typeof record.code === "string" && Object.hasOwn(BY_CODE, record.code)) return BY_CODE[record.code];
  if (typeof record.effective_phase === "string" && Object.hasOwn(BY_PHASE, record.effective_phase)) return BY_PHASE[record.effective_phase];
  return undefined;
}

const FINISHED_BOLETO = "La jornada ya ha terminado: el boleto ya no se puede cambiar.";

/**
 * A window 409 (`{code, sale_opens_at, voting_closes_at, now, effective_phase}`) as a ServiceError with client-authored
 * copy. The date of `sale_opens_at` is added to the "sale not opened" copy when the backend sent one (Madrid time).
 * Anything that is not a recognised window refusal gives undefined, so the caller falls back to the generic conflict.
 */
export function windowConflict(detail: unknown, context: WindowContext): ServiceError | undefined {
  const code = windowFailureCode(detail);
  if (!code) return undefined;
  if (code === "sale-not-opened") {
    const raw = asRecord(detail)?.sale_opens_at;
    const opens = typeof raw === "string" ? formatDateTime(raw) : null;
    return opens ? new ServiceError(code, { message: `La venta de esta jornada aún no ha abierto. Se abre el ${opens}.` }) : new ServiceError(code);
  }
  if (context === "boleto" && (code === "escrutinio-pending" || code === "escrutinio-disponible")) return new ServiceError(code, { message: FINISHED_BOLETO });
  return new ServiceError(code);
}
