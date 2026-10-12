import type { Metadata } from "next";
import celebrating from "../../../../../../../../public/celebrating.png";
import { Sticker, trims } from "@/components/ui/sticker";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/shell/page-container";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { Button, buttonClasses } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { requireUser } from "@/features/auth/server/session";
import { canManageGroup } from "@/features/groups/domain/groups";
import { loadGroup } from "@/features/groups/server/queries";
import { canSetBoleto, phaseOf } from "@/features/matchdays/domain/matchdays";
import { loadMatchday } from "@/features/matchdays/server/queries";
import { Boleto } from "@/features/porras/components/boleto";
import { toBoletoFixtures } from "@/features/porras/components/sheet/boleto-screen";
import { columnsDraftFromBoleto, singleFromColumns } from "@/features/porras/domain/columns";
import { loadFinalBoleto, loadPorra } from "@/features/porras/server/queries";
import { formatDateTime } from "@/lib/format-date";
import { isRouteId } from "@/lib/route-id";

export const metadata: Metadata = { title: "Boleto de la peña" };

/** Read-only official boleto of the peña: any member can see it; the admin also gets the way to change it. */
export default async function Page({ params }: { params: Promise<{ groupId: string; porraId: string }> }) {
  await requireUser();
  const { groupId, porraId } = await params;
  if (!isRouteId(groupId) || !isRouteId(porraId)) notFound();
  const group = await loadGroup(groupId);
  const porra = await loadPorra(groupId, porraId);
  const [matchday, boleto] = await Promise.all([loadMatchday(porra.jornadaId), loadFinalBoleto(groupId, porraId)]);
  const setBy = boleto?.setByUserId ? group.members.find(member => member.userId === boleto.setByUserId)?.displayName : null;
  const canChange = porra.status !== "closed" && canSetBoleto(phaseOf(matchday));
  const setAt = boleto ? formatDateTime(boleto.setAt) : null;
  return (
    <PageContainer eyebrow={group.name} title="Boleto de la peña" className="max-w-[64rem]" sticker={<Sticker src={celebrating} trim={trims.celebrating} width={96} tilt={-4} className="absolute -right-3 -top-14" />}>
      {boleto ? (
        <>
          {(setAt || setBy) && (
            <p className="text-label text-fg-muted">Boleto fijado{setAt ? ` el ${setAt}` : ""}{setBy ? ` por ${setBy}` : ""}.</p>
          )}
          <Boleto
            mode="final" jornada={matchday.number} temporada={matchday.seasonLabel} fixtures={toBoletoFixtures(matchday.fixtures)}
            value={singleFromColumns(columnsDraftFromBoleto(boleto), 0)} columns={boleto.columns} costEur={boleto.costEur}
            columnPicks={boleto.columnas.length > 1 ? columnsDraftFromBoleto(boleto).columns : undefined}
          />
          <a href={`/groups/${groupId}/porras/${porraId}/boleto.pdf`} download className={buttonClasses({ variant: "primary", fullWidth: true })}>
            <DownloadSimple size={20} weight="bold" aria-hidden="true" />
            <span>Descargar PDF</span>
          </a>
        </>
      ) : (
        <StatusMessage>Tu admin todavía no ha decidido el boleto de la peña.</StatusMessage>
      )}
      {canManageGroup(group) && canChange && <Button href={`/groups/${groupId}/porras/${porraId}/editar`} variant="secondary" fullWidth>{boleto ? "Cambiar el boleto" : "Ajustar y confirmar"}</Button>}
      <Button href={`/groups/${groupId}/porras/${porraId}`} variant="secondary" fullWidth>Volver a la porra</Button>
    </PageContainer>
  );
}
