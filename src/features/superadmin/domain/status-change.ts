import { STATUS_LABELS, type AdminJornadaStatus } from "./jornadas";

/**
 * One backend call of a status change. `open` needs sale_opens_at (the existing one, or `now` when missing), `close` and `reopen`
 * are the dedicated endpoints, `patch-draft` is PATCH status=draft (the only way back to draft). `reaches` is the status the
 * jornada is left in when the step succeeds, used to report a partial failure honestly.
 */
export type StatusStep =
  | { action: "open"; reaches: "active"; usesNow: boolean }
  | { action: "close"; reaches: "past" }
  | { action: "reopen"; reaches: "active" }
  | { action: "patch-draft"; reaches: "draft" };

/**
 * The backend only allows draft <-> active and active <-> past, so draft -> past and past -> draft go through active.
 * Returns the ordered steps (empty when nothing changes). `hasSaleOpensAt` tells whether `open` can reuse the stored value.
 */
export function planStatusChange(from: AdminJornadaStatus, to: AdminJornadaStatus, hasSaleOpensAt: boolean): StatusStep[] {
  if (from === to) return [];
  const open: StatusStep = { action: "open", reaches: "active", usesNow: !hasSaleOpensAt };
  const close: StatusStep = { action: "close", reaches: "past" };
  const reopen: StatusStep = { action: "reopen", reaches: "active" };
  const toDraft: StatusStep = { action: "patch-draft", reaches: "draft" };
  if (from === "draft") return to === "active" ? [open] : [open, close];
  if (from === "active") return to === "past" ? [close] : [toDraft];
  return to === "active" ? [reopen] : [reopen, toDraft];
}

/** True when the plan has an `open` step with no stored sale_opens_at: the admin must be asked for it (or accept "now"). */
export function needsSaleOpensAt(steps: readonly StatusStep[]): boolean {
  return steps.some(step => step.action === "open" && step.usesNow);
}

/** One line for the confirm when the change is chained through Activa; null for a direct edge. */
export function chainNote(steps: readonly StatusStep[]): string | null {
  return steps.length > 1 ? "Este cambio pasa por Activa: se hace en dos pasos seguidos." : null;
}

/** Copy for a chain that stopped after `reached`: the jornada is not where the admin wanted it. */
export function partialFailureMessage(reached: AdminJornadaStatus, target: AdminJornadaStatus, reason: string): string {
  return `La jornada ha quedado en «${STATUS_LABELS[reached]}» y no ha llegado a «${STATUS_LABELS[target]}». ${reason}`;
}
