import type { Metadata } from "next";
import scoreArt from "../../../../../../../public/asset_score.png";
import { Sticker } from "@/components/ui/sticker";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/server/session";
import { canManageGroup } from "@/features/groups/domain/groups";
import { loadGroup } from "@/features/groups/server/queries";
import { votingClosedMessage } from "@/features/matchdays/domain/matchday-state";
import { canCreatePorra, phaseOf } from "@/features/matchdays/domain/matchdays";
import { loadActiveMatchdays } from "@/features/matchdays/server/queries";
import { CreatePorraForm } from "@/features/porras/components/admin/create-porra-form";
import { isRouteId } from "@/lib/route-id";

export const metadata: Metadata = { title: "Crear porra" };

/** Admin only: jornada, budget and format of the porra of the peña. Members are sent to the forbidden page. */
export default async function Page({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{ jornada?: string }> }) {
  await requireUser();
  const { groupId } = await params;
  const { jornada } = await searchParams;
  if (!isRouteId(groupId)) notFound();
  const group = await loadGroup(groupId);
  if (!canManageGroup(group)) redirect("/forbidden");
  const active = await loadActiveMatchdays();
  // A porra can only be created inside the voting window; the other active jornadas just explain why not.
  const matchdays = active.filter(matchday => canCreatePorra(phaseOf(matchday)));
  const blockedReason = matchdays.length === 0 && active[0] ? votingClosedMessage(active[0]) : null;
  const jornadas = matchdays.map(matchday => ({ id: matchday.id, number: matchday.number, seasonLabel: matchday.seasonLabel }));
  const preferred = typeof jornada === "string" && jornadas.some(item => item.id === jornada) ? jornada : null;
  return (
    <PageContainer eyebrow={group.name} title="Crear porra" description="Elige la jornada, el presupuesto y un formato de dobles y triples que quepa." sticker={<Sticker src={scoreArt} width={112} tilt={-5} className="absolute -right-3 -top-10" />}>
      <CreatePorraForm groupId={groupId} jornadas={jornadas} blockedReason={blockedReason} defaultJornadaId={preferred ?? jornadas[0]?.id ?? null} />
      <Button href={`/groups/${groupId}`} variant="secondary" fullWidth>Volver a la peña</Button>
    </PageContainer>
  );
}
