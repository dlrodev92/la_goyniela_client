import type { Metadata } from "next";
import { Suspense } from "react";
import { EntryMarker } from "@/components/motion/entry-marker";
import { PageTransition } from "@/components/motion/page-transition";
import { isRouteId } from "@/lib/route-id";
import { pageOf } from "@/features/superadmin/domain/admin";
import { parseAdminStatus } from "@/features/superadmin/domain/jornadas";
import { parseTab } from "@/features/superadmin/domain/tabs";
import { requireSuperadmin } from "@/features/superadmin/server/access";
import { IngestPanel } from "@/features/superadmin/components/ingest-panel";
import { JornadasPanel } from "@/features/superadmin/components/jornadas-panel";
import { PanelSkeleton } from "@/features/superadmin/components/panel-skeleton";
import { PanelTabs } from "@/features/superadmin/components/panel-tabs";
import { TeamsPanel } from "@/features/superadmin/components/teams-panel";
import { UsersPanel } from "@/features/superadmin/components/users-panel";

export const metadata: Metadata = { title: "Superadmin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The single superadmin page: header with the ingest action, a tab bar (`?tab=`) and the active tab's table. Filters, pagination
 * and the expanded jornada (`?abrir=`) live in the URL; only the active tab loads data.
 */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  await requireSuperadmin();
  const query = await searchParams;
  const tab = parseTab(first(query.tab));
  const page = pageOf(first(query.pagina));
  const abrir = first(query.abrir);
  const includeDeleted = first(query.eliminadas) === "1";
  const status = parseAdminStatus(first(query.estado));
  const onlySuperadmins = first(query.solo) === "superadmins";
  const boundary = [tab, page, includeDeleted, status, onlySuperadmins].join("|");
  return (
    <PageTransition>
      <div className="mx-auto grid w-full max-w-6xl gap-3 px-3 py-4 *:min-w-0 md:px-6 md:py-8">
        <EntryMarker />
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="grid gap-0.5">
            <h1 className="font-ui text-h2 font-semibold text-fg">Panel de superadmin</h1>
            <p className="text-meta text-fg-muted">Los endpoints admin tienen un límite de 30 solicitudes por minuto.</p>
          </div>
          <IngestPanel />
        </header>
        <PanelTabs current={tab} />
        <Suspense key={boundary} fallback={<PanelSkeleton />}>
          {tab === "jornadas" && <JornadasPanel includeDeleted={includeDeleted} status={status} page={page} abrir={abrir && isRouteId(abrir) ? abrir : null} />}
          {tab === "equipos" && <TeamsPanel includeDeleted={includeDeleted} page={page} />}
          {tab === "usuarios" && <UsersPanel onlySuperadmins={onlySuperadmins} page={page} />}
        </Suspense>
      </div>
    </PageTransition>
  );
}
