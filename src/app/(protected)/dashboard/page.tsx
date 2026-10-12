import type { Metadata } from "next";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import { Suspended } from "@/components/motion/suspended";
import { AppLink } from "@/components/shell/app-link";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionBar } from "@/components/ui/section-bar";
import { Sticker, trims } from "@/components/ui/sticker";
import { StatusMessage } from "@/components/ui/status-message";
import { requireUser } from "@/features/auth/server/session";
import { GroupList } from "@/features/groups/components/group-list";
import { loadMyGroups } from "@/features/groups/server/queries";
import { ActiveMatchdayCard, ActiveMatchdayCardSkeleton } from "@/features/matchdays/components/active-matchday-card";
import { FinalBoletoCards } from "@/features/porras/components/final-boleto-cards";
import { ServiceError } from "@/lib/http/errors";

import administrator from "../../../../public/administrator.png";
import jersey from "../../../../public/asset_jersey.png";

export const metadata: Metadata = { title: "Inicio" };

const SUMMARY_LIMIT = 3;

export default async function DashboardPage() {
  const user = await requireUser();
  let groups: Awaited<ReturnType<typeof loadMyGroups>> | null = null;
  try { groups = await loadMyGroups(); }
  catch (error) { if (!(error instanceof ServiceError)) throw error; }
  const name = user.displayName?.trim();
  return (
    // Bare surface: the page lays out its own cream cards straight over the full-bleed fondo (RouteScene).
    <PageContainer surface="bare" className="gap-6 pt-8">
      <section aria-labelledby="dashboard-title" className="brut-panel relative grid min-h-44 gap-3 p-5 pr-32 sm:min-h-56 sm:pr-48">
        <p className="label-meta flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-2.5 w-6 border-2 border-border-soft bg-signal" />
          <span aria-hidden="true" className="tabular-nums">01 —</span>
          Inicio
        </p>
        <h1 id="dashboard-title" className="font-display text-[clamp(3rem,15vw,5.5rem)] uppercase leading-[0.88] text-fg">
          Hola{name ? <>, <span className="block break-words">{name}</span></> : null}
        </h1>
        <Sticker src={administrator} trim={trims.administrator} width={104} tilt={3} preload className="absolute -bottom-5 right-2 sm:right-6 sm:[--sticker-w:150px]" />
      </section>

      <section aria-labelledby="matchday-summary" className="grid gap-4">
        <SectionBar index="02" title="Jornada" headingId="matchday-summary" />
        <Suspended fallback={<ActiveMatchdayCardSkeleton />}>
          <ActiveMatchdayCard />
        </Suspended>
        <Suspended fallback={null}>
          <FinalBoletoCards />
        </Suspended>
      </section>

      <section aria-labelledby="groups-summary" className="grid gap-4">
        <SectionBar
          index="03"
          title="Tus peñas"
          headingId="groups-summary"
          action={groups && groups.length > 0 ? (
            <AppLink href="/groups" transitionTypes={["nav-tab"]} indicator={false} className="fx-link inline-flex min-h-touch shrink-0 items-center text-label font-bold uppercase tracking-wide text-action">Ver todas</AppLink>
          ) : undefined}
        />
        {groups === null ? (
          <StatusMessage tone="error">No hemos podido cargar tus peñas ahora mismo. Inténtalo de nuevo más tarde.</StatusMessage>
        ) : groups.length === 0 ? (
          <Card surface={1} padding="lg">
            <EmptyState
              illustration={jersey}
              headingLevel={3}
              title="Aún no tienes peña"
              description="Crea una peña para tus amigos o únete con el código que te hayan pasado."
              action={
                <div className="grid w-full max-w-xs gap-3">
                  <Button href="/groups/new" fullWidth leadingIcon={<Plus size={20} weight="bold" aria-hidden="true" />}>Crear peña</Button>
                  <Button href="/groups/join" variant="secondary" fullWidth>Unirme con código</Button>
                </div>
              }
            />
          </Card>
        ) : (
          <>
            <GroupList groups={groups.slice(0, SUMMARY_LIMIT)} userId={user.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button href="/groups/new" fullWidth leadingIcon={<Plus size={20} weight="bold" aria-hidden="true" />}>Crear peña</Button>
              <Button href="/groups/join" variant="secondary" fullWidth>Unirme con código</Button>
            </div>
          </>
        )}
      </section>
    </PageContainer>
  );
}
