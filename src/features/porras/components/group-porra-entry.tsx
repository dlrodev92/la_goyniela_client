import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { Badge } from "@/components/ui/badge";
import { StatusMessage } from "@/components/ui/status-message";
import { canManageGroup, type GroupSummary } from "@/features/groups/domain/groups";
import { JornadaCalendarEmpty, JornadaCalendarRow } from "@/features/jornadas/components/jornada-calendar";
import { canCreatePorra, phaseOf, type Matchday } from "@/features/matchdays/domain/matchdays";
import { loadActiveMatchdays } from "@/features/matchdays/server/queries";
import { ServiceError } from "@/lib/http/errors";
import { matchdayStateLabel } from "@/features/matchdays/domain/matchday-state";
import { isVotable, porraLifecycle, porraLifecycleLabel } from "../domain/lifecycle";
import type { Porra } from "../domain/porras";
import { loadGroupPorras, loadMyPorraPicks } from "../server/queries";
import { PorraLifecycleBadge } from "./porra-lifecycle-badge";

type Entry = { porra: Porra; voted: boolean };

/**
 * The active jornadas for one peña as the same tear-off calendar cards as /jornadas. Each card links to the group's porra
 * for that jornada (or to the admin create flow when none exists) and shows the porra and voting state.
 */
export async function GroupPorraEntry({ group }: { group: Pick<GroupSummary, "id" | "role"> }) {
  let matchdays: Matchday[];
  let entries: Entry[] = [];
  try {
    matchdays = await loadActiveMatchdays();
    if (matchdays.length > 0) {
      const activeIds = new Set(matchdays.map(item => item.id));
      const porras = (await loadGroupPorras(group.id)).filter(item => activeIds.has(item.jornadaId));
      entries = await Promise.all(porras.map(async porra => ({ porra, voted: (await loadMyPorraPicks(group.id, porra.id)) !== null })));
    }
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return <StatusMessage tone="error">No hemos podido cargar la porra ahora mismo. Inténtalo de nuevo más tarde.</StatusMessage>;
  }
  if (matchdays.length === 0) {
    return <JornadaCalendarEmpty title="Todavía no hay jornada abierta" description="Cuando se abra la próxima jornada podrás votar aquí." />;
  }
  const sorted = [...matchdays].sort((a, b) => a.number - b.number);
  const canCreate = canManageGroup(group);
  // One porra per jornada is the norm; if there were several, the card opens the first one.
  const entryOf = (matchday: Matchday) => entries.find(entry => entry.porra.jornadaId === matchday.id);
  const hrefFor = (matchday: Matchday) => {
    const entry = entryOf(matchday);
    if (entry) return `/groups/${group.id}/porras/${entry.porra.id}`;
    return canCreate && canCreatePorra(phaseOf(matchday)) ? `/groups/${group.id}/porras/nueva?jornada=${matchday.id}` : null;
  };
  const footerFor = (matchday: Matchday) => {
    const entry = entryOf(matchday);
    const phase = phaseOf(matchday);
    if (!entry) {
      if (canCreate && canCreatePorra(phase)) return <Badge tone="action">Crear porra</Badge>;
      return <Badge tone="neutral">Sin porra</Badge>;
    }
    const { porra, voted } = entry;
    const state = porraLifecycle({ phase, hasBoleto: porra.hasBoleto, status: porra.status });
    return (
      <>
        {/* The card already carries the jornada state; the porra badge only shows when it says something else. */}
        {porraLifecycleLabel(state) !== matchdayStateLabel(matchday) && <PorraLifecycleBadge state={state} />}
        {isVotable(state) && (voted
          ? <Badge tone="success" icon={<CheckCircle size={14} weight="fill" aria-hidden="true" />}>Ya votaste</Badge>
          : <Badge tone="warning">Sin votar</Badge>)}
      </>
    );
  };
  return (
    <div className="grid gap-3">
      <JornadaCalendarRow matchdays={sorted} hrefFor={hrefFor} footerFor={footerFor} />
    </div>
  );
}
