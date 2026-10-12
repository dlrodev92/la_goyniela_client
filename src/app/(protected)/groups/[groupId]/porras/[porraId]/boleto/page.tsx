import type { Metadata } from "next";
import vote from "../../../../../../../../public/vote_image.png";
import { Sticker, trims } from "@/components/ui/sticker";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/shell/page-container";
import { requireUser } from "@/features/auth/server/session";
import { JornadaInfo } from "@/features/jornadas/components/jornada-info";
import { loadMatchday } from "@/features/matchdays/server/queries";
import { BoletoScreen } from "@/features/porras/components/sheet/boleto-screen";
import { loadPorra } from "@/features/porras/server/queries";
import { loadLosillaJornada } from "@/features/results/server/queries";
import { isRouteId } from "@/lib/route-id";

export const metadata: Metadata = { title: "Mi boleto" };

/** Direct visit (shared URL, reload): the boleto docked beside the jornada and Losilla's notes, like the panel over the porra page. */
export default async function Page({ params }: { params: Promise<{ groupId: string; porraId: string }> }) {
  await requireUser();
  const { groupId, porraId } = await params;
  if (!isRouteId(groupId) || !isRouteId(porraId)) notFound();
  const porra = await loadPorra(groupId, porraId);
  const matchday = await loadMatchday(porra.jornadaId);
  const losilla = await loadLosillaJornada(matchday);
  return (
    <PageContainer eyebrow="Porra" title="Mi boleto" className="max-w-[80rem] pb-40" sticker={<Sticker src={vote} trim={trims.vote} width={80} tilt={5} className="absolute -right-2 -top-14" />}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_30rem]">
        <div className="min-w-0 lg:order-2">
          <BoletoScreen groupId={groupId} porraId={porraId} variant="page" />
        </div>
        <div className="min-w-0 lg:order-1">
          <JornadaInfo matchday={matchday} losilla={losilla} />
        </div>
      </div>
    </PageContainer>
  );
}
