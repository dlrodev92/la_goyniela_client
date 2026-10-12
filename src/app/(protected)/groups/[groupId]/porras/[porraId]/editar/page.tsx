import type { Metadata } from "next";
import type { ReactNode } from "react";
import yellowCard from "../../../../../../../../public/asset_yellow_card.png";
import { Sticker } from "@/components/ui/sticker";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { requireUser } from "@/features/auth/server/session";
import { canManageGroup } from "@/features/groups/domain/groups";
import { loadGroup } from "@/features/groups/server/queries";
import { boletoLockedMessage } from "@/features/matchdays/domain/matchday-state";
import { canSetBoleto, phaseOf } from "@/features/matchdays/domain/matchdays";
import { loadMatchday } from "@/features/matchdays/server/queries";
import { BoletoEditor } from "@/features/porras/components/admin/boleto-editor";
import { ColumnsBoletoEditor } from "@/features/porras/components/admin/columns-boleto-editor";
import { toBoletoFixtures } from "@/features/porras/components/sheet/boleto-screen";
import { columnsDraftFromBoleto, columnsDraftFromPropuesta, singleFromColumns } from "@/features/porras/domain/columns";
import { draftFromPropuesta } from "@/features/porras/domain/logic";
import { specOf } from "@/features/porras/domain/modes";
import { termsOf } from "@/features/porras/domain/porra-view";
import { loadFinalBoleto, loadPorra, loadPropuesta } from "@/features/porras/server/queries";
import { ServiceError } from "@/lib/http/errors";
import { isRouteId } from "@/lib/route-id";

export const metadata: Metadata = { title: "Ajustar boleto de la peña" };

/** Admin only: edits the proposal (or the saved final boleto) and confirms it. Full page: the sheet is for members' boletos. */
export default async function Page({ params }: { params: Promise<{ groupId: string; porraId: string }> }) {
  await requireUser();
  const { groupId, porraId } = await params;
  if (!isRouteId(groupId) || !isRouteId(porraId)) notFound();
  const group = await loadGroup(groupId);
  if (!canManageGroup(group)) redirect("/forbidden");
  const porra = await loadPorra(groupId, porraId);
  const back = `/groups/${groupId}/porras/${porraId}`;
  const matchday = await loadMatchday(porra.jornadaId);
  const phase = phaseOf(matchday);
  // The backend refuses PUT /boleto outside lista_abre_pronto..escrutinio_pendiente: do not offer an editor that cannot save.
  if (porra.status === "closed" || !canSetBoleto(phase)) {
    return (
      <PageContainer eyebrow={group.name} title="Ajustar boleto" className="max-w-[64rem] pb-32" sticker={<Sticker src={yellowCard} width={56} tilt={8} className="absolute -right-2 -top-10" />}>
        <StatusMessage tone="info">{porra.status === "closed" ? "La porra está cerrada y el boleto ya no se puede cambiar." : boletoLockedMessage(phase)}</StatusMessage>
        <Button href={back} variant="secondary" fullWidth>Volver a la porra</Button>
      </PageContainer>
    );
  }
  const [boleto, propuesta] = await Promise.all([
    loadFinalBoleto(groupId, porraId),
    loadPropuesta(groupId, porraId).catch((error: unknown) => {
      if (!(error instanceof ServiceError)) throw error;
      return null;
    }),
  ]);
  const spec = specOf(porra);
  const terms = termsOf(porra);
  // Share bars describe one column: the multi-column editors (sencilla, Intuición) draw none.
  const multiColumn = spec.modo === "sencilla" || spec.modo === "intuicion";
  const proposal = propuesta && !multiColumn ? { weights: Object.fromEntries(propuesta.matches.map(match => [match.position, match.weights])), pleno: propuesta.pleno } : null;
  const common = { groupId, porraId, jornada: matchday.number, temporada: matchday.seasonLabel, fixtures: toBoletoFixtures(matchday.fixtures), proposal };
  const source = boleto ? "boleto" : "propuesta";

  let editor: ReactNode = <StatusMessage tone="error">No hemos podido calcular la propuesta ahora mismo. Vuelve a la porra e inténtalo de nuevo.</StatusMessage>;
  if (spec.modo === "sencilla" || spec.modo === "intuicion") {
    const proposalDraft = propuesta ? columnsDraftFromPropuesta(propuesta, spec) : null;
    const initialDraft = boleto ? columnsDraftFromBoleto(boleto) : proposalDraft;
    if (initialDraft) {
      editor = <ColumnsBoletoEditor {...common} initialDraft={initialDraft} source={source} proposalDraft={proposalDraft} terms={{ ...terms, modo: spec.modo, columnas: spec.columnas }} />;
    }
  } else {
    const proposalDraft = propuesta ? draftFromPropuesta(propuesta) : null;
    const initialDraft = boleto ? singleFromColumns(columnsDraftFromBoleto(boleto), 0) : proposalDraft;
    if (initialDraft) editor = <BoletoEditor {...common} initialDraft={initialDraft} source={source} proposalDraft={proposalDraft} terms={terms} />;
  }

  return (
    <PageContainer eyebrow={group.name} title="Ajustar boleto" className="max-w-[64rem] pb-32" sticker={<Sticker src={yellowCard} width={56} tilt={8} className="absolute -right-2 -top-10" />}>
      {editor}
      <Button href={back} variant="secondary" fullWidth>Volver a la porra</Button>
    </PageContainer>
  );
}
