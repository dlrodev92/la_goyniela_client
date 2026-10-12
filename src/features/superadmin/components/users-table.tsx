"use client";

import { useActionState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { patchUserAction } from "../server/actions";
import { initialActionState, type AdminUser } from "../domain/admin";
import { formatDayMadrid } from "../domain/datetime";
import { InlineConfirm } from "./inline-confirm";
import { StatusBadge, panelSurface } from "./panel-ui";
import { useInlineConfirm } from "./use-inline-confirm";

const GRID = "grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_7rem_6.5rem_6.5rem]";
type Field = "isSuperadmin" | "isActive";

/** Switch-looking toggle that does not change anything by itself: it asks for an inline confirm first. */
function Toggle({ on, label, onClick, onLabel, offLabel }: { on: boolean; label: string; onClick: () => void; onLabel: string; offLabel: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      className="tap inline-flex h-8 items-center gap-2 rounded-md px-1.5 text-label [--press-scale:0.97] hover-fine:bg-surface-2 md:h-7"
    >
      <span aria-hidden="true" className={cn("relative h-4 w-7 rounded-full border transition-colors duration-(--duration-fast)", on ? "border-success/60 bg-success/30" : "border-border-soft bg-surface-1")}>
        <span className={cn("absolute top-0.5 size-2.5 rounded-full transition-[left] duration-(--duration-fast) motion-reduce:transition-none", on ? "left-3.5 bg-success" : "left-0.5 bg-fg-muted")} />
      </span>
      <span className={on ? "text-fg" : "text-fg-muted"}>{on ? onLabel : offLabel}</span>
    </button>
  );
}

function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const [state, action, pending] = useActionState(patchUserAction.bind(null, user.id), initialActionState);
  const confirm = useInlineConfirm<Field, typeof state>(state);
  const name = user.displayName || user.email;
  const selfNote = isSelf ? " Eres tú: perderás este acceso." : "";
  const field = confirm.payload;
  const next = field === "isSuperadmin" ? !user.isSuperadmin : !user.isActive;
  let message: ReactNode = null;
  if (field === "isSuperadmin") {
    message = user.isSuperadmin
      ? <>¿Quitar superadmin a <strong>{name}</strong>? Dejará de poder usar este panel. No se puede quitar al último superadmin.{isSelf && <strong className="text-danger">{selfNote}</strong>}</>
      : <>¿Hacer superadmin a <strong>{name}</strong>? Tendrá acceso completo al panel: jornadas, equipos, usuarios e importaciones.</>;
  } else if (field === "isActive") {
    message = user.isActive
      ? <>¿Desactivar a <strong>{name}</strong>? No podrá iniciar sesión mientras la cuenta esté inactiva.{isSelf && <strong className="text-danger">{selfNote}</strong>}</>
      : <>¿Activar a <strong>{name}</strong>? Podrá volver a iniciar sesión.</>;
  }
  const dangerous = field !== null && (field === "isSuperadmin" ? user.isSuperadmin : user.isActive);
  return (
    <li className="border-b border-border-soft last:border-b-0">
      <div className={cn("grid items-center gap-x-3 gap-y-0.5 px-3 py-1.5 hover-fine:bg-surface-2/50", GRID)}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-label font-medium">{name}</span>
          {isSelf && <StatusBadge>Tú</StatusBadge>}
        </span>
        <span className="truncate text-label text-fg-muted max-md:col-span-3 max-md:order-last">{user.email} <span className="md:hidden">· alta {formatDayMadrid(user.createdAt)}</span></span>
        <span className="text-label tabular-nums text-fg-muted max-md:hidden">{formatDayMadrid(user.createdAt)}</span>
        <Toggle on={user.isSuperadmin} label={`Superadmin: ${name}`} onLabel="Superadmin" offLabel="Superadmin" onClick={() => confirm.open("isSuperadmin")} />
        <Toggle on={user.isActive} label={`Cuenta activa: ${name}`} onLabel="Activo" offLabel="Inactivo" onClick={() => confirm.open("isActive")} />
      </div>
      {field && (
        <div className="px-3 pb-3">
          <InlineConfirm
            action={action} pending={pending} onCancel={confirm.close} tone={dangerous ? "danger" : "default"}
            confirmLabel={dangerous ? "Sí, confirmar" : "Sí, aplicar"}
            error={state.status === "error" ? state.message : undefined} message={message}
          >
            <input type="hidden" name="field" value={field} />
            <input type="hidden" name="value" value={String(next)} />
          </InlineConfirm>
        </div>
      )}
    </li>
  );
}

/** Users of the loaded page with inline Superadmin / Activo toggles, each confirmed in place. */
export function UsersTable({ users, selfId, toolbar }: { users: AdminUser[]; selfId: string; toolbar: ReactNode }) {
  return (
    <div className="grid gap-2">
      {toolbar}
      {users.length === 0 ? <p className="rounded-lg border border-border-soft px-3 py-6 text-center text-label text-fg-muted">Ningún usuario coincide con el filtro.</p> : (
        <div className={panelSurface}>
          <div className={cn("hidden items-center gap-x-3 border-b border-border-soft bg-surface-2 px-3 py-1.5 text-meta font-medium text-fg-muted md:grid", GRID)} aria-hidden="true">
            {["Nombre", "Correo", "Alta", "Superadmin", "Activo"].map(header => <span key={header}>{header}</span>)}
          </div>
          <ul>{users.map(user => <UserRow key={user.id} user={user} isSelf={user.id === selfId} />)}</ul>
        </div>
      )}
    </div>
  );
}
