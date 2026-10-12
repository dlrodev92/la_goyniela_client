import type { Metadata } from "next";
import vote from "../../../../public/vote_image.png";
import { Sticker, trims } from "@/components/ui/sticker";
import type { CSSProperties } from "react";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { redirect } from "next/navigation";

import { AppLink } from "@/components/shell/app-link";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionBar } from "@/components/ui/section-bar";
import { requireUser } from "@/features/auth/server/session";
import { canManageGroup } from "@/features/groups/domain/groups";
import { loadMyGroups } from "@/features/groups/server/queries";
import { phaseOf } from "@/features/matchdays/domain/matchdays";
import { loadActiveMatchdays } from "@/features/matchdays/server/queries";
import { isVotable, porraLifecycle } from "@/features/porras/domain/lifecycle";
import { groupByJornada, porraFormatLabel } from "@/features/porras/domain/porra-view";
import { loadPorrasOfGroups } from "@/features/porras/server/queries";

import jersey from "../../../../public/asset_jersey.png";
import waiting from "../../../../public/waiting_image.png";

export const metadata: Metadata = { title: "Quiniela" };

/**
 * Quick entry to the open porra: one goes straight to it, several show a picker (by jornada first when more than one
 * jornada is active), none a waiting state.
 */
export default async function QuinielaPage() {
  await requireUser();
  // One call each, in parallel; no per-group requests.
  const [groups, matchdays] = await Promise.all([loadMyGroups(), loadActiveMatchdays()]);

  if (groups.length === 0) {
    return (
      <PageContainer centered>
        <EmptyState
          illustration={jersey}
          title="Aún no tienes peña"
          description="Crea una peña o únete con el código de un amigo para empezar a votar."
          action={
            <div className="grid w-full max-w-xs gap-3">
              <Button href="/groups/new" fullWidth>Crear peña</Button>
              <Button href="/groups/join" variant="secondary" fullWidth>Unirme con código</Button>
            </div>
          }
        />
      </PageContainer>
    );
  }

  if (matchdays.length === 0) {
    return (
      <PageContainer centered>
        <EmptyState
          illustration={waiting}
          title="Todavía no hay jornada abierta"
          description="Cuando se abra la próxima jornada podrás votar aquí."
        />
      </PageContainer>
    );
  }

  // One request per peña (no jornada filter), then split by the phase of each porra's jornada: the porra status is not used.
  const phases = new Map(matchdays.map(matchday => [matchday.id, phaseOf(matchday)]));
  const active = (await loadPorrasOfGroups(groups.map(group => group.id))).filter(entry => phases.has(entry.porra.jornadaId));
  const stateOf = ({ porra }: (typeof active)[number]) => porraLifecycle({ phase: phases.get(porra.jornadaId) ?? "fuera_de_ventana", hasBoleto: porra.hasBoleto, status: porra.status });
  // Only porras the member can still act on; admins also get the ones that wait for the final boleto.
  const entries = active.filter(entry => isVotable(stateOf(entry)));
  const adminGroupIds = new Set(groups.filter(canManageGroup).map(group => group.id));
  const pending = active.filter(entry => adminGroupIds.has(entry.groupId) && stateOf(entry) === "awaiting-boleto");
  const [only] = entries;
  if (entries.length === 1 && only && pending.length === 0) redirect(`/groups/${only.groupId}/porras/${only.porra.id}`);

  if (entries.length === 0 && pending.length === 0) {
    const closedPorras = active.length > 0;
    return (
      <PageContainer centered>
        <EmptyState
          illustration={waiting}
          title={closedPorras ? "No hay porras abiertas para votar" : "Tu admin todavía no ha abierto la porra"}
          description={closedPorras
            ? "La votación de las jornadas actuales no está abierta ahora mismo. Puedes ver las porras desde tus peñas."
            : matchdays.length === 1 && matchdays[0]
              ? `Cuando tu peña abra la porra de la jornada ${matchdays[0].number} podrás rellenar tu boleto aquí.`
              : "Cuando tu peña abra la porra de una jornada abierta podrás rellenar tu boleto aquí."}
          action={<Button href="/groups" variant="secondary">Ir a mis peñas</Button>}
        />
      </PageContainer>
    );
  }

  const choices = groupByJornada(matchdays, entries);
  const askJornada = choices.length > 1;
  const names = new Map(groups.map(group => [group.id, group]));
  let index = 0;
  return (
    <PageContainer
      sticker={<Sticker src={vote} trim={trims.vote} width={80} tilt={5} className="absolute -right-2 -top-14" />}
      eyebrow={askJornada || choices.length === 0 ? "Quiniela" : `Jornada ${choices[0]?.number ?? ""}`}
      title={askJornada ? "¿Qué jornada quieres votar?" : "Quiniela"}
      description={choices.length === 0
        ? "No hay porras abiertas para votar ahora mismo."
        : askJornada ? "Hay varias jornadas abiertas. Elige la peña de la jornada que quieres rellenar." : "Elige la peña con la que quieres rellenar tu boleto."}
    >
      {choices.map(choice => (
        <section key={choice.matchdayId} aria-labelledby={askJornada ? `jornada-${choice.matchdayId}` : undefined} className="grid gap-3">
          {askJornada && <SectionBar index={String(choice.number).padStart(2, "0")} title={`Jornada ${choice.number}`} headingId={`jornada-${choice.matchdayId}`} />}
          <ul className="grid gap-3">
            {choice.items.map(({ groupId, porra }) => {
              const group = names.get(groupId);
              const i = index++;
              return (
                <li key={porra.id} className="stagger-in" style={{ "--i": i } as CSSProperties}>
                  <AppLink
                    href={`/groups/${groupId}/porras/${porra.id}`}
                    transitionTypes={["nav-forward"]}
                    className="tap block rounded-card text-fg no-underline [--press-scale:0.985]"
                  >
                    <Card surface={1} padding="md" interactive className="grid-cols-[1fr_auto] items-center gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-display text-h2 uppercase">{group?.name ?? "Tu peña"}</p>
                        <p className="text-label text-fg-muted">{askJornada ? `Jornada ${choice.number} · ` : ""}{porraFormatLabel(porra)}</p>
                      </div>
                      <CaretRight size={24} weight="bold" aria-hidden="true" className="text-action" />
                    </Card>
                  </AppLink>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {pending.length > 0 && (
        <section aria-labelledby="pendiente-boleto" className="grid gap-3">
          <SectionBar title="Pendiente de boleto" headingId="pendiente-boleto" />
          <p className="text-label text-fg-muted">La votación ya ha cerrado y falta fijar el boleto de la peña.</p>
          <ul className="grid gap-3">
            {pending.map(({ groupId, porra }) => (
              <li key={porra.id}>
                <AppLink href={`/groups/${groupId}/porras/${porra.id}`} transitionTypes={["nav-forward"]} className="tap block rounded-card text-fg no-underline [--press-scale:0.985]">
                  <Card surface={1} padding="md" interactive className="grid-cols-[1fr_auto] items-center gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-display text-h2 uppercase">{names.get(groupId)?.name ?? "Tu peña"}</p>
                      <p className="text-label text-fg-muted">Jornada {matchdays.find(matchday => matchday.id === porra.jornadaId)?.number} · {porraFormatLabel(porra)}</p>
                    </div>
                    <CaretRight size={24} weight="bold" aria-hidden="true" className="text-action" />
                  </Card>
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
