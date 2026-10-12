import { cn } from "@/lib/cn";
import type { ActionState } from "../domain/admin";

/** One-line inline result of a server action: an alert for errors (rate limit included), a polite status for successes. */
export function ActionMessage({ state, className }: { state: ActionState; className?: string }) {
  if (!state.message) return null;
  const error = state.status === "error";
  return (
    <p role={error ? "alert" : "status"} className={cn("text-label", error ? "text-danger" : "text-success", className)}>
      {state.message}
    </p>
  );
}
