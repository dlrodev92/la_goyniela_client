import { FilterChips, hrefWith } from "./filter-chips";
import { LoadError } from "./load-error";
import { Pager } from "./pager";
import { TeamsTable } from "./teams-table";
import { loadAdminTeams } from "../server/queries";

const PATH = "/superadmin";

/** Equipos tab: loads only this tab's page; search over that page happens in the client table. */
export async function TeamsPanel({ includeDeleted, page }: { includeDeleted: boolean; page: number }) {
  const result = await loadAdminTeams(includeDeleted, page);
  if (!result.ok) return <LoadError message={result.message} rateLimited={result.rateLimited} />;
  const base = { tab: "equipos", eliminadas: includeDeleted ? 1 : null };
  const hrefFor = (target: number) => hrefWith(PATH, { ...base, pagina: target > 1 ? target : null });
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <FilterChips label="Equipos eliminados" chips={[{ href: hrefWith(PATH, { ...base, eliminadas: includeDeleted ? null : 1 }), label: "Incluir eliminados", active: includeDeleted }]} />
      <Pager page={page} hasNext={result.data.hasNext} hrefFor={hrefFor} />
    </div>
  );
  return <TeamsTable teams={result.data.items} toolbar={toolbar} />;
}
