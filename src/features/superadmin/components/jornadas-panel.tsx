import { FilterChips, hrefWith } from "./filter-chips";
import { JornadasTable } from "./jornadas-table";
import { LoadError } from "./load-error";
import { Pager } from "./pager";
import { ADMIN_STATUS_FILTERS, type AdminJornadaStatus } from "../domain/jornadas";
import { loadAdminJornadas, loadPinnedJornada } from "../server/queries";

const PATH = "/superadmin";

/** Jornadas tab: loads only this tab's page. `abrir` expands a row (and pins it on top when it is not on the loaded page). */
export async function JornadasPanel({ includeDeleted, status, page, abrir }: { includeDeleted: boolean; status: AdminJornadaStatus | null; page: number; abrir: string | null }) {
  const result = await loadAdminJornadas(includeDeleted, status, page);
  if (!result.ok) return <LoadError message={result.message} rateLimited={result.rateLimited} />;
  const base = { tab: "jornadas", eliminadas: includeDeleted ? 1 : null, estado: status };
  const hrefFor = (target: number) => hrefWith(PATH, { ...base, pagina: target > 1 ? target : null });
  let items = result.data.items;
  if (abrir && !items.some(jornada => jornada.id === abrir)) {
    const pinned = await loadPinnedJornada(abrir);
    if (pinned) items = [pinned, ...items];
  }
  const toolbar = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <FilterChips label="Filtrar por estado" chips={[
        { href: hrefWith(PATH, { ...base, estado: null }), label: "Todas", active: status === null },
        ...ADMIN_STATUS_FILTERS.map(filter => ({ href: hrefWith(PATH, { ...base, estado: filter.status }), label: filter.label, active: status === filter.status })),
      ]} />
      <FilterChips label="Jornadas eliminadas" chips={[{ href: hrefWith(PATH, { ...base, eliminadas: includeDeleted ? null : 1 }), label: "Incluir eliminadas", active: includeDeleted }]} />
      <div className="md:ml-auto"><Pager page={page} hasNext={result.data.hasNext} hrefFor={hrefFor} /></div>
    </div>
  );
  return <JornadasTable jornadas={items} initialOpenId={abrir} toolbar={toolbar} />;
}
