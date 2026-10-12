import waiting from "../../../public/waiting_image.png";

import { SystemState } from "./system-state";

/** Loading screen: the illustration uncovers itself in pixel steps (EmptyState). Content only: callers provide the shell. */
export function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="delayed-in">
      <SystemState illustration={waiting} title="Cargando" description="Un momento, estamos preparando la página." />
    </div>
  );
}
