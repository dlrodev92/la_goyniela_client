import { Badge, type BadgeTone } from "@/components/ui/badge";
import { porraLifecycleLabel, type PorraLifecycle } from "../domain/lifecycle";

const TONES: Record<PorraLifecycle, BadgeTone> = {
  "voting-open": "action",
  "voting-soon": "neutral",
  "awaiting-boleto": "warning",
  "boleto-confirmed": "success",
  finished: "neutral",
  preparing: "neutral",
};

/** The state of a porra as a badge: lime while voting is open, amber while the boleto is missing, green once confirmed. */
export function PorraLifecycleBadge({ state }: { state: PorraLifecycle }) {
  return <Badge tone={TONES[state]}>{porraLifecycleLabel(state)}</Badge>;
}
