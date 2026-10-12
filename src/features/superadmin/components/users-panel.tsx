import { requireUser } from "../../auth/server/session";
import { FilterChips, hrefWith } from "./filter-chips";
import { LoadError } from "./load-error";
import { Pager } from "./pager";
import { UsersTable } from "./users-table";
import { loadAdminUsers } from "../server/queries";

const PATH = "/superadmin";

/** Usuarios tab: loads only this tab's page. */
export async function UsersPanel({ onlySuperadmins, page }: { onlySuperadmins: boolean; page: number }) {
  const [user, result] = await Promise.all([requireUser(), loadAdminUsers(onlySuperadmins, page)]);
  if (!result.ok) return <LoadError message={result.message} rateLimited={result.rateLimited} />;
  const base = { tab: "usuarios", solo: onlySuperadmins ? "superadmins" : null };
  const hrefFor = (target: number) => hrefWith(PATH, { ...base, pagina: target > 1 ? target : null });
  const toolbar = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <FilterChips label="Filtrar usuarios" chips={[
        { href: hrefWith(PATH, { tab: "usuarios" }), label: "Todos", active: !onlySuperadmins },
        { href: hrefWith(PATH, { tab: "usuarios", solo: "superadmins" }), label: "Solo superadmins", active: onlySuperadmins },
      ]} />
      <div className="md:ml-auto"><Pager page={page} hasNext={result.data.hasNext} hrefFor={hrefFor} /></div>
    </div>
  );
  return <UsersTable users={result.data.items} selfId={user.id} toolbar={toolbar} />;
}
