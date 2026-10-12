import type { EffectivePhase } from "../../matchdays/domain/matchdays";
import type { PorraStatus } from "./porras";

/**
 * Where a porra stands. It follows the phase of its jornada, not `porra.status`: the backend never writes "closed", so
 * the status alone would show every porra as open forever. A `closed` status stays an override in case that changes.
 */
export type PorraLifecycle = "voting-open" | "voting-soon" | "awaiting-boleto" | "boleto-confirmed" | "finished" | "preparing";

export function porraLifecycle({ phase, hasBoleto, status }: { phase: EffectivePhase; hasBoleto: boolean; status: PorraStatus }): PorraLifecycle {
  if (status === "closed") return "finished";
  switch (phase) {
    case "en_preparacion": return "preparing";
    case "lista_abre_pronto": return "voting-soon";
    case "in_window": return "voting-open";
    case "fuera_de_ventana":
    case "escrutinio_pendiente": return hasBoleto ? "boleto-confirmed" : "awaiting-boleto";
    case "escrutinio_disponible": return "finished";
  }
}

const LABELS: Record<PorraLifecycle, string> = {
  "voting-open": "Votación abierta",
  "voting-soon": "La venta abre pronto",
  "awaiting-boleto": "Votación cerrada · falta el boleto",
  "boleto-confirmed": "Boleto confirmado",
  finished: "Finalizada",
  preparing: "En preparación",
};

export const porraLifecycleLabel = (state: PorraLifecycle): string => LABELS[state];

/** Members can fill or change their boleto only while the voting is open. */
export const isVotable = (state: PorraLifecycle): boolean => state === "voting-open";
