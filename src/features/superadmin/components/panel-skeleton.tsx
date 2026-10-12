import { Skeleton } from "@/components/ui/skeleton";
import { panelSurface } from "./panel-ui";

/** Table-shaped placeholder shown while the active tab's page loads. */
export function PanelSkeleton() {
  return (
    <div aria-busy="true" className={panelSurface}>
      <span className="sr-only" role="status">Cargando…</span>
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="border-b border-border-soft px-3 py-2.5 last:border-b-0"><Skeleton className="h-5 w-full rounded" /></div>
      ))}
    </div>
  );
}
