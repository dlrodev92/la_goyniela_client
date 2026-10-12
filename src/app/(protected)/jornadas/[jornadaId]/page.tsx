import type { Metadata } from "next";
import ticket from "../../../../../public/asset_ticket.png";
import { Sticker } from "@/components/ui/sticker";
import { notFound } from "next/navigation";
import { Suspended } from "@/components/motion/suspended";
import { PageContainer } from "@/components/shell/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/server/session";
import { JornadaInfo } from "@/features/jornadas/components/jornada-info";
import { StandingsSection } from "@/features/jornadas/components/standings-section";
import { matchdayStateLabel, matchdayStateTone } from "@/features/matchdays/components/matchday-state";
import { phaseOf } from "@/features/matchdays/domain/matchdays";
import { loadMatchday } from "@/features/matchdays/server/queries";
import { JornadaPorras, JornadaPorrasSkeleton } from "@/features/porras/components/jornada-porras";
import { loadLosillaJornada } from "@/features/results/server/queries";
import { isRouteId } from "@/lib/route-id";

export const metadata: Metadata = { title: "Jornada" };

export default async function Page({ params }: { params: Promise<{ jornadaId: string }> }) {
  await requireUser();
  const { jornadaId } = await params;
  if (!isRouteId(jornadaId)) notFound();
  const matchday = await loadMatchday(jornadaId);
  const losilla = await loadLosillaJornada(matchday);

  return (
    <PageContainer eyebrow={matchday.seasonLabel} title={`Jornada ${matchday.number}`} revealTitle sticker={<Sticker src={ticket} width={96} tilt={8} className="absolute -right-3 -top-12" />}>
      <div><Badge tone={matchdayStateTone(matchday)}>{matchdayStateLabel(matchday)}</Badge></div>

      <StandingsSection />

      <Suspended fallback={<JornadaPorrasSkeleton />}>
        <JornadaPorras jornadaId={jornadaId} phase={phaseOf(matchday)} />
      </Suspended>

      <JornadaInfo matchday={matchday} losilla={losilla} />

      <div className="grid gap-3">
        <Button href="/jornadas" variant="secondary" fullWidth transitionTypes={["nav-back"]}>Todas las jornadas</Button>
      </div>
    </PageContainer>
  );
}
