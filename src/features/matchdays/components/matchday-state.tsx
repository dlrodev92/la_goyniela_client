import type { BadgeTone } from "@/components/ui/badge";
import type { Matchday } from "../domain/matchdays";
import { canVote, phaseOf } from "../domain/matchdays";

export { matchdayStateLabel, matchdayStateHint } from "../domain/matchday-state";

/** Badge tone that goes with `matchdayStateLabel`: lime while voting is open, neutral otherwise. */
export function matchdayStateTone(matchday: Matchday): BadgeTone {
  return canVote(phaseOf(matchday)) ? "action" : "neutral";
}
