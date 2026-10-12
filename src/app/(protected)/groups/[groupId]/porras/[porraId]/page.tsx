import type { Metadata } from "next";
import goal from "../../../../../../../public/asset_porteria.png";
import { Sticker } from "@/components/ui/sticker";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { PageContainer } from "@/components/shell/page-container";
import { requireUser } from "@/features/auth/server/session";
import { canManageGroup } from "@/features/groups/domain/groups";
import { loadGroup } from "@/features/groups/server/queries";
import { JornadaInfo } from "@/features/jornadas/components/jornada-info";
import { canEditPorra, canSetBoleto, hasFullBoleto, phaseOf } from "@/features/matchdays/domain/matchdays";
import { loadMatchday } from "@/features/matchdays/server/queries";
import { toBoletoFixtures } from "@/features/porras/components/sheet/boleto-screen";
import { PorraAdminPanel } from "@/features/porras/components/admin/porra-admin-panel";
import { PorraSettings } from "@/features/porras/components/admin/porra-settings";
import { MyBoletoStatus } from "@/features/porras/components/my-boleto-status";
import { PorraActionBar } from "@/features/porras/components/porra-action-bar";
import { PorraHeader } from "@/features/porras/components/porra-header";
import { PorraParticipation } from "@/features/porras/components/porra-participation";
import { specOf } from "@/features/porras/domain/modes";
import { termsOf, votingGate } from "@/features/porras/domain/porra-view";
import { loadMyPorraPicks, loadPorra, loadPorraPicks } from "@/features/porras/server/queries";
import { loadLosillaJornada } from "@/features/results/server/queries";
import { ServiceError } from "@/lib/http/errors";
import { isRouteId } from "@/lib/route-id";

export const metadata: Metadata = { title: "Porra" };

export default async function Page({ params }: { params: Promise<{ groupId: string; porraId: string }> }) {
  const user = await requireUser();
  const { groupId, porraId } = await params;
  if (!isRouteId(groupId) || !isRouteId(porraId)) notFound();
  // Non-members get 403 "not a member of this group": loadGroup sends them to /forbidden ("No perteneces a esta peña").
  const group = await loadGroup(groupId);
  const porra = await loadPorra(groupId, porraId);
  const [matchday, mine, view] = await Promise.all([
    loadMatchday(porra.jornadaId),
    loadMyPorraPicks(groupId, porraId),
    loadPorraPicks(groupId, porraId).catch((error: unknown) => {
      if (!(error instanceof ServiceError)) throw error;
      return null;
    }),
  ]);
  const losilla = await loadLosillaJornada(matchday);
  const phase = phaseOf(matchday);
  const gate = votingGate(porra, matchday, hasFullBoleto(matchday));
  const admin = canManageGroup(group);
  const avatars = Object.fromEntries(group.members.map(member => [member.userId, member.avatarUrl]));

  return (
    <PageContainer eyebrow={group.name} title={`Jornada ${matchday.number}`} className="pb-44 [&_h1]:tabular-nums" sticker={<Sticker src={goal} width={104} tilt={5} className="absolute -right-3 -top-10" />}>
      <AutoRefresh />
      <PorraHeader groupName={group.name} jornada={matchday.number} temporada={matchday.seasonLabel} porra={porra} phase={phase} view={view} avatars={avatars} />
      <MyBoletoStatus voted={mine !== null} hasBoleto={porra.hasBoleto} canVote={gate.open} />
      {admin && porra.status !== "closed" && canEditPorra(phase) && <PorraSettings groupId={groupId} porra={porra} />}
      {admin && (
        <PorraAdminPanel
          groupId={groupId} porraId={porraId} hasBoleto={porra.hasBoleto} canSetBoleto={porra.status !== "closed" && canSetBoleto(phase)} jornada={matchday.number} temporada={matchday.seasonLabel}
          fixtures={toBoletoFixtures(matchday.fixtures)}
          terms={termsOf(porra)} spec={specOf(porra)}
        />
      )}
      <PorraParticipation view={view} fixtures={toBoletoFixtures(matchday.fixtures)} currentUserId={user.id} avatars={avatars} />
      <JornadaInfo matchday={matchday} losilla={losilla} />
      <PorraActionBar groupId={groupId} porraId={porraId} canVote={gate.open} reason={gate.reason} voted={mine !== null} hasBoleto={porra.hasBoleto} />
    </PageContainer>
  );
}
