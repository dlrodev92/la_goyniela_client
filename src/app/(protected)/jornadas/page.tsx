import type { Metadata } from "next";
import scarf from "../../../../public/asset_scarf.png";
import { Sticker } from "@/components/ui/sticker";
import type { CSSProperties } from "react";
import { PageContainer } from "@/components/shell/page-container";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionBar } from "@/components/ui/section-bar";
import { requireUser } from "@/features/auth/server/session";
import { JornadaCalendarEmpty, JornadaCalendarRow } from "@/features/jornadas/components/jornada-calendar";
import { JornadaCard } from "@/features/jornadas/components/jornada-card";
import { StatusChips } from "@/features/jornadas/components/status-chips";
import { splitForCalendar } from "@/features/jornadas/domain/calendar";
import { parseStatusFilter } from "@/features/jornadas/domain/jornadas";
import { loadAllMatchdays } from "@/features/matchdays/server/queries";
import scoreArt from "../../../../public/asset_score.png";

export const metadata: Metadata = { title: "Jornadas" };

export default async function Page({ searchParams }: { searchParams: Promise<{ estado?: string | string[] }> }) {
  await requireUser();
  const selected = parseStatusFilter((await searchParams).estado);
  // The list already excludes drafts and soft-deleted jornadas.
  const { upcoming, past } = splitForCalendar(await loadAllMatchdays());
  const showUpcoming = selected !== "past";
  const showPast = selected !== "active";
  return (
    <PageContainer eyebrow="Quiniela" title="Jornadas" description="Consulta cada jornada: partidos, horarios, resultados, bote y escrutinio." sticker={<Sticker src={scarf} width={104} tilt={-5} className="absolute -right-3 -top-12" />}>
      <StatusChips selected={selected} />
      {showUpcoming && (
        <section aria-labelledby="proximas-heading" className="grid gap-3">
          <SectionBar index="01" title="Próximas jornadas" headingId="proximas-heading" />
          {upcoming.length === 0 ? <JornadaCalendarEmpty /> : <JornadaCalendarRow matchdays={upcoming} />}
        </section>
      )}
      {showPast && (past.length > 0 || !showUpcoming) && (
        <section aria-labelledby="pasadas-heading" className="grid gap-3">
          <SectionBar index={showUpcoming ? "02" : "01"} title="Jornadas anteriores" headingId="pasadas-heading" />
          {past.length === 0 ? (
            <Card surface={1} padding="lg">
              <EmptyState illustration={scoreArt} title="Ninguna jornada finalizada" description="Las jornadas terminadas se guardarán aquí." headingLevel={3} />
            </Card>
          ) : (
            <ul className="grid gap-3">
              {past.map((matchday, index) => (
                <li key={matchday.id} className="stagger-in" style={{ "--i": index } as CSSProperties}><JornadaCard matchday={matchday} /></li>
              ))}
            </ul>
          )}
        </section>
      )}
    </PageContainer>
  );
}
