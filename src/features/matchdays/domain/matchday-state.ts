import type { Matchday } from "./matchdays";
import { phaseOf, type EffectivePhase } from "./matchdays";
import { formatDateTime } from "../../../lib/format-date";

type StateInput = Pick<Matchday, "status" | "saleOpensAt" | "votingClosesAt" | "effectivePhase" | "serverNow">;

/** User-facing state of a matchday, from its voting phase. `draft` is "Próximamente"; a closed window reads as closed voting. */
export function matchdayStateLabel(matchday: StateInput): string {
  switch (phaseOf(matchday)) {
    case "en_preparacion": return "Próximamente";
    case "lista_abre_pronto": return "La venta abre pronto";
    case "in_window": return "Votación abierta";
    case "fuera_de_ventana": return "Votación cerrada";
    case "escrutinio_pendiente":
    case "escrutinio_disponible": return "Finalizada";
  }
}

/** Short explanation shown next to the state badge when the state alone is not self-explanatory. */
export function matchdayStateHint(matchday: Pick<Matchday, "status">): string | null {
  return matchday.status === "draft" ? "La votación todavía no ha abierto" : null;
}

/** Why the picks cannot be sent in this phase. Decided from the matchday we already know, never from backend text. */
export function phaseClosedMessage(phase: EffectivePhase, matchday: Pick<Matchday, "saleOpensAt" | "votingClosesAt">): string {
  switch (phase) {
    case "en_preparacion": return "La jornada aún está en preparación.";
    case "lista_abre_pronto": {
      const opens = formatDateTime(matchday.saleOpensAt);
      return opens ? `La venta de esta jornada aún no ha abierto. Se abre el ${opens}.` : "La venta de esta jornada aún no ha abierto.";
    }
    case "in_window": return "La votación ya no está disponible. Recarga la página.";
    case "fuera_de_ventana": {
      const closes = formatDateTime(matchday.votingClosesAt);
      return closes ? `El plazo de votación cerró el ${closes}.` : "El plazo de votación ha terminado.";
    }
    case "escrutinio_pendiente":
    case "escrutinio_disponible": return "La jornada ha terminado.";
  }
}

/** Why the admin cannot set or change the final boleto in this phase; null while it still can. */
export function boletoLockedMessage(phase: EffectivePhase): string | null {
  switch (phase) {
    case "en_preparacion": return "La jornada aún está en preparación: todavía no se puede fijar el boleto de la peña.";
    case "escrutinio_pendiente":
    case "escrutinio_disponible": return "La jornada ya ha terminado: el boleto ya no se puede cambiar.";
    default: return null;
  }
}

/** Message for a boleto the member cannot edit (the matchday's phase decides, never the backend `detail`). */
export function votingClosedMessage(matchday: StateInput): string {
  return phaseClosedMessage(phaseOf(matchday), matchday);
}

/** Read-only notice shown instead of the picks form when voting is not open. */
export function readOnlyNotice(matchday: Pick<Matchday, "status">, hasPicks: boolean): string {
  if (matchday.status === "draft") return "La votación todavía no ha abierto. Podrás votar cuando la jornada esté activa.";
  return `La votación de esta jornada está cerrada${hasPicks ? ", así que tu pronóstico guardado es solo de lectura." : " y no enviaste pronóstico."}`;
}
