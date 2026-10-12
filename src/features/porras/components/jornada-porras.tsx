import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { AppLink } from "@/components/shell/app-link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { canManageGroup } from "@/features/groups/domain/groups";
import { loadMyGroups } from "@/features/groups/server/queries";
import { ServiceError } from "@/lib/http/errors";
import { canCreatePorra, type EffectivePhase } from "@/features/matchdays/domain/matchdays";
import { isVotable, porraLifecycle } from "../domain/lifecycle";
import { porraFormatLabel } from "../domain/porra-view";
import { loadPorrasOfJornada } from "../server/queries";
import { PorraLifecycleBadge } from "./porra-lifecycle-badge";

/** Placeholder with the same card, heading and row height as the final content (one row; most users have one peña). */
export function JornadaPorrasSkeleton() {
  return (
    <Card as="section" surface={2} padding="lg" pixelCorner aria-busy="true" header={<h2>Tus porras de esta jornada</h2>}>
      <Skeleton variant="block" className="h-17 [--skeleton-bg:var(--color-surface-3)]" />
    </Card>
  );
}

/** "Tus porras de esta jornada": one link per peña of the caller that has a porra for the jornada. */
export async function JornadaPorras({ jornadaId, phase }: { jornadaId: string; /** Voting phase of the jornada: it decides whether admins can open a porra and what each porra shows. */ phase: EffectivePhase }) {
  const canCreate = canCreatePorra(phase);
  let entries: Awaited<ReturnType<typeof loadPorrasOfJornada>> = [];
  let names = new Map<string, string>();
  let creatable: { id: string; name: string }[] = [];
  try {
    const groups = await loadMyGroups();
    if (groups.length === 0) return null;
    names = new Map(groups.map(group => [group.id, group.name]));
    entries = await loadPorrasOfJornada(groups.map(group => group.id), jornadaId);
    // Admin only: the peñas they manage that still have no porra for this jornada.
    if (canCreate) creatable = groups.filter(group => canManageGroup(group) && !entries.some(entry => entry.groupId === group.id)).map(group => ({ id: group.id, name: group.name }));
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return null;
  }
  return (
    <Card as="section" surface={2} padding="lg" pixelCorner aria-labelledby="jornada-porras-heading" header={<h2 id="jornada-porras-heading">Tus porras de esta jornada</h2>}>
      {entries.length === 0 && creatable.length === 0 ? (
        <p className="text-label text-fg-muted">Ninguna de tus peñas ha abierto una porra para esta jornada todavía.</p>
      ) : (
        <ul className="grid gap-3">
          {creatable.map(group => (
            <li key={`new-${group.id}`}>
              <AppLink
                href={`/groups/${group.id}/porras/nueva?jornada=${jornadaId}`}
                transitionTypes={["nav-forward"]}
                className="fx-row flex min-h-touch items-center justify-between gap-3 rounded-control border border-dashed border-action bg-surface-1 px-4 py-3 text-fg no-underline"
              >
                <span className="grid min-w-0 gap-1">
                  <span className="break-words font-bold">Crear porra en {group.name}</span>
                  <span className="text-label text-fg-muted">Eres admin y esta peña aún no tiene porra.</span>
                </span>
                <CaretRight size={20} weight="bold" aria-hidden="true" className="shrink-0 text-action" />
              </AppLink>
            </li>
          ))}
          {entries.map(({ groupId, porra }) => {
            const name = names.get(groupId) ?? "tu peña";
            const state = porraLifecycle({ phase, hasBoleto: porra.hasBoleto, status: porra.status });
            const open = isVotable(state);
            return (
              <li key={porra.id}>
                <AppLink
                  href={`/groups/${groupId}/porras/${porra.id}`}
                  transitionTypes={["nav-forward"]}
                  className="fx-row flex min-h-touch items-center justify-between gap-3 rounded-control border border-border-soft bg-surface-1 px-4 py-3 text-fg no-underline"
                >
                  <span className="grid min-w-0 gap-1">
                    <span className="break-words font-bold">{open ? `Rellenar mi boleto en ${name}` : `Ver la porra de ${name}`}</span>
                    <span className="text-label text-fg-muted">{porraFormatLabel(porra)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <PorraLifecycleBadge state={state} />
                    <CaretRight size={20} weight="bold" aria-hidden="true" className="text-action" />
                  </span>
                </AppLink>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
