"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import { TeamCrest } from "@/components/ui/team-crest";
import { cn } from "@/lib/cn";
import { createTeamAction, deleteTeamAction, restoreTeamAction, updateTeamAction } from "../server/actions";
import { filterTeams, initialActionState, type AdminTeam } from "../domain/admin";
import { ActionMessage } from "./action-message";
import { InlineConfirm } from "./inline-confirm";
import { PanelButton, StatusBadge, panelControl, panelSurface } from "./panel-ui";
import { TeamForm } from "./team-form";
import { useInlineConfirm } from "./use-inline-confirm";

const GRID = "grid-cols-[2rem_minmax(0,1fr)_auto] md:grid-cols-[2rem_minmax(0,1.5fr)_minmax(0,1fr)_6rem_4rem_minmax(0,1.3fr)_6.5rem]";
const GENDER_LABEL: Record<string, string> = { men: "Masculino", women: "Femenino" };

function TeamRow({ team, open, onToggle }: { team: AdminTeam; open: boolean; onToggle: () => void }) {
  const [editState, editAction, editPending] = useActionState(updateTeamAction.bind(null, team.id), initialActionState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteTeamAction.bind(null, team.id), initialActionState);
  const [restoreState, restoreAction, restorePending] = useActionState(restoreTeamAction.bind(null, team.id), initialActionState);
  const confirmDelete = useInlineConfirm<true, typeof deleteState>(deleteState);
  const deleted = team.deletedAt !== null;
  return (
    <li className={cn("border-b border-border-soft last:border-b-0", open && "bg-surface-2/30")}>
      <div
        onClick={event => { if (!(event.target as HTMLElement).closest("button,a,input,select,textarea,label,form")) onToggle(); }}
        className={cn("grid items-center gap-x-3 gap-y-0.5 px-3 py-1.5 hover-fine:bg-surface-2/50", GRID)}
      >
        <TeamCrest name={team.name} logoUrl={team.logoUrl} size="sm" />
        <button
          type="button" onClick={onToggle} aria-expanded={open} aria-label={`${team.name}. ${open ? "Contraer" : "Editar"}`}
          className="tap flex min-h-8 min-w-0 items-center gap-2 text-left [--press-scale:0.99]"
        >
          <CaretRight size={12} weight="bold" aria-hidden="true" className={cn("shrink-0 text-fg-muted transition-transform duration-(--duration-fast) motion-reduce:transition-none", open && "rotate-90")} />
          <span className="truncate text-label font-medium">{team.name}</span>
          {deleted && <StatusBadge kind="danger">Eliminado</StatusBadge>}
        </button>
        <div className="flex justify-end md:order-last">
          {deleted ? (
            <form action={restoreAction}><PanelButton type="submit" loading={restorePending} aria-label={`Restaurar ${team.name}`}>Restaurar</PanelButton></form>
          ) : (
            <PanelButton variant="danger" onClick={() => confirmDelete.open(true)} aria-label={`Eliminar ${team.name}`}>Eliminar</PanelButton>
          )}
        </div>
        <span className="truncate text-label text-fg-muted max-md:col-start-2 max-md:col-span-2 md:col-auto">{team.shortName ?? "—"}</span>
        <span className="truncate text-label text-fg-muted max-md:hidden">{team.gender ? (GENDER_LABEL[team.gender] ?? team.gender) : "—"}{team.gender && !team.genderKnown && " (?)"}</span>
        <span className="text-label tabular-nums text-fg-muted max-md:hidden">{team.country ?? "—"}</span>
        <span className="truncate text-label text-fg-muted max-md:col-start-2 max-md:col-span-2 md:col-auto" title={team.competitionId}>{team.competitionId}</span>
      </div>
      {(confirmDelete.payload || restoreState.status === "error") && (
        <div className="grid gap-2 px-3 pb-3">
          {confirmDelete.payload && (
            <InlineConfirm
              action={deleteAction} pending={deletePending} onCancel={confirmDelete.close} confirmLabel="Sí, eliminar" tone="danger"
              error={deleteState.status === "error" ? deleteState.message : undefined}
              message={<>¿Eliminar {team.name}? Se oculta del listado público y se puede restaurar. Si algún partido usa el equipo, no se podrá eliminar.</>}
            />
          )}
          <ActionMessage state={restoreState.status === "error" ? restoreState : initialActionState} />
        </div>
      )}
      {open && (
        <div className="border-t border-border-soft bg-surface-2/40">
          {/* Re-keyed on the saved data so the uncontrolled inputs pick up the revalidated values. */}
          <TeamForm key={JSON.stringify(team)} idPrefix={`edit-${team.id}`} team={team} state={editState} action={editAction} pending={editPending} onCancel={onToggle} />
          <p className="px-3 pb-2 text-meta text-fg-muted">ID {team.id} · {team.entityId}. Los cambios se aplican a todas las jornadas que usan este equipo.</p>
        </div>
      )}
    </li>
  );
}

/** Teams of the loaded page: dense table, client-side search over that page, inline create form on top and inline edit per row. */
export function TeamsTable({ teams, toolbar }: { teams: AdminTeam[]; toolbar: ReactNode }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [createState, createAction, createPending] = useActionState(createTeamAction, initialActionState);
  const creating = useInlineConfirm<true, typeof createState>(createState);
  const visible = useMemo(() => filterTeams(teams, query), [teams, query]);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative block min-w-0 flex-1 basis-56 md:max-w-xs">
          <MagnifyingGlass size={14} weight="bold" aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar en esta página…" autoComplete="off"
            aria-label="Buscar equipos en esta página" className={cn(panelControl, "pl-8")}
          />
        </span>
        {toolbar}
        <PanelButton variant="primary" onClick={() => (creating.payload ? creating.close() : creating.open(true))} aria-expanded={creating.payload !== null} className="md:ml-auto">
          <Plus size={14} weight="bold" aria-hidden="true" /> Nuevo equipo
        </PanelButton>
      </div>
      <p className="text-meta text-fg-muted" aria-live="polite">{visible.length} de {teams.length} {teams.length === 1 ? "equipo" : "equipos"} en esta página</p>
      <div className={panelSurface}>
        {creating.payload && (
          <div className="border-b border-border-soft bg-surface-2/40">
            <TeamForm idPrefix="new-team" state={createState} action={createAction} pending={createPending} onCancel={creating.close} />
          </div>
        )}
        <div className={cn("hidden items-center gap-x-3 border-b border-border-soft bg-surface-2 px-3 py-1.5 text-meta font-medium text-fg-muted md:grid", GRID)} aria-hidden="true">
          {["", "Nombre", "Corto", "Género", "País", "Competición", ""].map((header, index) => <span key={index}>{header}</span>)}
        </div>
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-label text-fg-muted">{query ? "Ningún equipo de esta página coincide con la búsqueda." : "No hay equipos en esta página."}</p>
        ) : (
          <ul>{visible.map(team => <TeamRow key={team.id} team={team} open={openId === team.id} onToggle={() => setOpenId(current => (current === team.id ? null : team.id))} />)}</ul>
        )}
      </div>
    </div>
  );
}
