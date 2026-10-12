"use client";

import { useActionState } from "react";
import { updateJornadaAction } from "../server/actions";
import { initialActionState, type AdminJornada } from "../domain/admin";
import { isoToMadridLocal, formatShortMadrid } from "../domain/datetime";
import { ActionMessage } from "./action-message";
import { ComposicionEditor } from "./composicion-editor";
import { PField, PanelButton, panelControl } from "./panel-ui";

const READ_ONLY = [
  ["kickoffFirstAt", "Primer partido"], ["kickoffLastAt", "Último partido"], ["escrutinioExpectedAt", "Escrutinio previsto"], ["fetchedAt", "Importada"],
] as const;

/** Expanded area of a jornada: every date (sale_opens_at and voting_closes_at editable, the rest read-only) and the composición editor. */
export function JornadaDetail({ jornada }: { jornada: AdminJornada }) {
  const [state, action, pending] = useActionState(updateJornadaAction.bind(null, jornada.id), initialActionState);
  const fields = state.fields ?? {};
  const deleted = jornada.deletedAt !== null;
  const id = `jornada-${jornada.id}`;
  return (
    <div className="grid gap-4 border-t border-border-soft bg-surface-2/40 p-3">
      {/* Re-keyed on the saved values so the uncontrolled inputs follow the revalidated (and recalculated) data. */}
      <form key={JSON.stringify([jornada.status, jornada.saleOpensAt, jornada.votingClosesAt])} action={action} noValidate className="grid gap-3">
        <input type="hidden" name="status" value={jornada.status} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
          <PField id={`${id}-sale`} label="Apertura de venta" error={fields.saleOpensAt}>
            <input id={`${id}-sale`} type="datetime-local" name="saleOpensAt" defaultValue={isoToMadridLocal(jornada.saleOpensAt)} disabled={pending || deleted} aria-invalid={fields.saleOpensAt ? true : undefined} className={`${panelControl} tabular-nums`} />
          </PField>
          <PField id={`${id}-closes`} label="Cierre de votación" error={fields.votingClosesAt}>
            <input id={`${id}-closes`} type="datetime-local" name="votingClosesAt" defaultValue={isoToMadridLocal(jornada.votingClosesAt)} disabled={pending || deleted} aria-invalid={fields.votingClosesAt ? true : undefined} className={`${panelControl} tabular-nums`} />
          </PField>
          {READ_ONLY.map(([key, label]) => (
            <div key={key} className="grid content-start gap-1">
              <span className="text-meta text-fg-muted">{label}</span>
              <span className="flex h-8 items-center text-label tabular-nums">{formatShortMadrid(jornada[key])}</span>
            </div>
          ))}
          <div className="flex items-end">
            <PanelButton type="submit" variant="primary" loading={pending} disabled={deleted}>Guardar fechas</PanelButton>
          </div>
        </div>
        <p className="text-meta text-fg-muted">Hora de Madrid. Al guardar un partido, el servidor recalcula último partido, cierre de votación y escrutinio previsto.</p>
        <ActionMessage state={state} />
      </form>
      <ComposicionEditor jornadaId={jornada.id} />
    </div>
  );
}
