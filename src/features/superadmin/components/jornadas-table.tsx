"use client";

import { useActionState, useState, type ReactNode } from "react";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { cn } from "@/lib/cn";
import {
  changeJornadaStatusAction, jornadaLifecycleAction, type StatusChangeState,
} from "../server/actions";
import { initialActionState, type ActionState, type AdminJornada } from "../domain/admin";
import { formatShortMadrid, isoToMadridLocal } from "../domain/datetime";
import { ADMIN_STATUS_FILTERS, STATUS_LABELS, type AdminJornadaStatus } from "../domain/jornadas";
import { chainNote, needsSaleOpensAt, planStatusChange } from "../domain/status-change";
import { ActionMessage } from "./action-message";
import { InlineConfirm } from "./inline-confirm";
import { JornadaDetail } from "./jornada-detail";
import { PField, PanelButton, StatusBadge, panelControl, panelSurface } from "./panel-ui";
import { useInlineConfirm } from "./use-inline-confirm";

const GRID = "grid-cols-3 md:grid-cols-[minmax(0,9rem)_15rem_repeat(3,minmax(0,1fr))_5.5rem]";
const initialStatus: StatusChangeState = initialActionState;

const STATUS_TEXT: Record<AdminJornadaStatus, string> = { draft: "text-fg", active: "text-success", past: "text-fg" };

/** Segmented Borrador / Activa / Pasada: any state can be picked from any state (the server action chains through Activa when needed). */
function StatusSegments({ jornada, disabled, onPick }: { jornada: AdminJornada; disabled: boolean; onPick: (to: AdminJornadaStatus) => void }) {
  return (
    <div role="group" aria-label={`Estado de la jornada ${jornada.number}`} className="inline-flex rounded-md border border-border-soft bg-surface-1 p-0.5">
      {ADMIN_STATUS_FILTERS.map(({ status, label }) => {
        const current = jornada.status === status;
        return (
          <button
            key={status} type="button" aria-pressed={current} disabled={disabled}
            onClick={() => { if (!current) onPick(status); }}
            className={cn(
              "tap h-8 rounded px-2.5 text-label [--press-scale:0.97] transition-colors duration-(--duration-fast) md:h-6",
              current ? cn("bg-surface-3 font-medium", STATUS_TEXT[status]) : "text-fg-muted hover-fine:bg-surface-2 hover-fine:text-fg",
              disabled && "pointer-events-none opacity-60",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function DateCell({ label, iso }: { label: string; iso: string | null }) {
  return (
    <span className="grid text-label tabular-nums max-md:order-4">
      <span className="text-meta text-fg-muted md:hidden">{label}</span>
      {formatShortMadrid(iso)}
    </span>
  );
}

function JornadaRow({ jornada, open, onToggle }: { jornada: AdminJornada; open: boolean; onToggle: () => void }) {
  const [statusState, statusAction, statusPending] = useActionState(changeJornadaStatusAction.bind(null, jornada.id), initialStatus);
  const [lifeState, lifeAction, lifePending] = useActionState(jornadaLifecycleAction.bind(null, jornada.id, jornada.deletedAt ? "restore" : "delete"), initialActionState as ActionState);
  const statusConfirm = useInlineConfirm<{ to: AdminJornadaStatus; nowLocal: string }, StatusChangeState>(statusState);
  const deleteConfirm = useInlineConfirm<true, ActionState>(lifeState);
  const deleted = jornada.deletedAt !== null;
  const target = statusConfirm.payload;
  const steps = target ? planStatusChange(jornada.status, target.to, jornada.saleOpensAt !== null) : [];
  const note = chainNote(steps);
  const restoreMessage = lifeState.status === "error" ? lifeState : null;

  return (
    <li className={cn("border-b border-border-soft last:border-b-0", open && "bg-surface-2/30")}>
      <div
        onClick={event => { if (!(event.target as HTMLElement).closest("button,a,input,select,textarea,label,form")) onToggle(); }}
        className={cn("grid items-center gap-x-3 gap-y-1.5 px-3 py-2 hover-fine:bg-surface-2/50", GRID)}
      >
        <button
          type="button" onClick={onToggle} aria-expanded={open} aria-label={`Jornada ${jornada.number}, temporada ${jornada.seasonLabel}. ${open ? "Contraer" : "Expandir"}`}
          className="tap flex min-h-8 min-w-0 items-center gap-2 text-left [--press-scale:0.99] max-md:order-1 max-md:col-span-2"
        >
          <CaretRight size={12} weight="bold" aria-hidden="true" className={cn("shrink-0 text-fg-muted transition-transform duration-(--duration-fast) motion-reduce:transition-none", open && "rotate-90")} />
          <span className="text-label font-medium tabular-nums">J{jornada.number}</span>
          <span className="truncate text-label text-fg-muted">{jornada.seasonLabel}</span>
          {deleted && <StatusBadge kind="danger">Eliminada</StatusBadge>}
        </button>
        <div className="max-md:order-3 max-md:col-span-3">
          <StatusSegments jornada={jornada} disabled={deleted || statusPending} onPick={to => { deleteConfirm.close(); statusConfirm.open({ to, nowLocal: isoToMadridLocal(new Date().toISOString()) }); }} />
        </div>
        <DateCell label="Apertura venta" iso={jornada.saleOpensAt} />
        <DateCell label="Cierre votación" iso={jornada.votingClosesAt} />
        <DateCell label="Primer partido" iso={jornada.kickoffFirstAt} />
        <div className="flex justify-end max-md:order-2">
          {deleted ? (
            <form action={lifeAction}>
              <PanelButton type="submit" loading={lifePending} aria-label={`Restaurar la jornada ${jornada.number}`}>Restaurar</PanelButton>
            </form>
          ) : (
            <PanelButton variant="danger" onClick={() => { statusConfirm.close(); deleteConfirm.open(true); }} aria-label={`Eliminar la jornada ${jornada.number}`}>Eliminar</PanelButton>
          )}
        </div>
      </div>

      {(target || deleteConfirm.payload || restoreMessage) && (
        <div className="grid gap-2 px-3 pb-3">
          {target && (
            <InlineConfirm
              action={statusAction} pending={statusPending} onCancel={statusConfirm.close} confirmLabel="Cambiar estado"
              error={statusState.status === "error" ? statusState.message : undefined}
              message={<>Jornada {jornada.number}: de <strong>{STATUS_LABELS[jornada.status]}</strong> a <strong>{STATUS_LABELS[target.to]}</strong>.{note && <span className="text-fg-muted"> {note}</span>}</>}
            >
              <input type="hidden" name="to" value={target.to} />
              {needsSaleOpensAt(steps) && (
                <PField id={`sale-${jornada.id}`} label="La venta se abre el (hora de Madrid)" hint="Esta jornada no tiene fecha de apertura de venta; se necesita para abrirla." error={statusState.fields?.saleOpensAt} className="max-w-xs">
                  <input id={`sale-${jornada.id}`} type="datetime-local" name="saleOpensAt" defaultValue={target.nowLocal} required aria-invalid={statusState.fields?.saleOpensAt ? true : undefined} className={cn(panelControl, "tabular-nums")} />
                </PField>
              )}
            </InlineConfirm>
          )}
          {deleteConfirm.payload && (
            <InlineConfirm
              action={lifeAction} pending={lifePending} onCancel={deleteConfirm.close} confirmLabel="Sí, eliminar" tone="danger"
              error={lifeState.status === "error" ? lifeState.message : undefined}
              message={<>¿Eliminar la jornada {jornada.number} ({jornada.seasonLabel})? Se oculta para todos los usuarios; no se borra nada y se puede restaurar.</>}
            />
          )}
          {restoreMessage && <ActionMessage state={restoreMessage} />}
        </div>
      )}
      {open && <JornadaDetail jornada={jornada} />}
    </li>
  );
}

const HEADERS = ["Jornada", "Estado", "Apertura venta", "Cierre votación", "Primer partido", ""] as const;

/** Jornadas of the loaded page as a dense table; one row expanded at a time, holding the dates form and the composición editor. */
export function JornadasTable({ jornadas, initialOpenId, toolbar }: { jornadas: AdminJornada[]; initialOpenId: string | null; toolbar: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  return (
    <div className="grid gap-2">
      {toolbar}
      {jornadas.length === 0 ? <p className="rounded-lg border border-border-soft px-3 py-6 text-center text-label text-fg-muted">Ninguna jornada coincide con el filtro.</p> : (
        <div className={panelSurface}>
          <div className={cn("hidden items-center gap-x-3 border-b border-border-soft bg-surface-2 px-3 py-1.5 text-meta font-medium text-fg-muted md:grid", GRID)} aria-hidden="true">
            {HEADERS.map((header, index) => <span key={index}>{header}</span>)}
          </div>
          <ul>
            {jornadas.map(jornada => (
              <JornadaRow key={jornada.id} jornada={jornada} open={openId === jornada.id} onToggle={() => setOpenId(current => (current === jornada.id ? null : jornada.id))} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
