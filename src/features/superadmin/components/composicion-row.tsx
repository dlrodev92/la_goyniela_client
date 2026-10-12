"use client";

import { useActionState } from "react";
import { updateComposicionAction, type ComposicionState, type TeamLabel } from "../server/actions";
import type { AdminComposicionRow } from "../domain/admin";
import { initialActionState } from "../domain/admin";
import { isoToMadridLocal } from "../domain/datetime";
import { ActionMessage } from "./action-message";
import { PanelButton, panelControl } from "./panel-ui";
import { TeamPicker } from "./team-picker";

const initial: ComposicionState = initialActionState;
export const COMPOSICION_GRID = "md:grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_11rem_minmax(0,11rem)_auto]";

/** One of the 15 partidos on a single dense line: both team pickers, kickoff (Madrid time), competition and its own save. */
export function ComposicionRow({ jornadaId, row, home, away }: { jornadaId: string; row: AdminComposicionRow; home: TeamLabel | null; away: TeamLabel | null }) {
  const [state, action, pending] = useActionState(updateComposicionAction.bind(null, jornadaId, row.position), initial);
  const fields = state.fields ?? {};
  const idBase = `comp-${jornadaId}-${row.position}`;
  return (
    <li className="py-1.5">
      <form action={action} noValidate className={`grid items-start gap-2 ${COMPOSICION_GRID}`}>
        <span className="pt-1.5 text-label font-medium tabular-nums text-fg-muted max-md:hidden">{row.position}</span>
        <TeamPicker name="homeTeamId" label={`Partido ${row.position}, local`} initial={{ id: row.homeTeamId, name: home?.name ?? `Equipo ${row.homeTeamId}`, logoUrl: home?.logoUrl ?? null }} error={fields.homeTeamId} />
        <TeamPicker name="awayTeamId" label={`Partido ${row.position}, visitante`} initial={{ id: row.awayTeamId, name: away?.name ?? `Equipo ${row.awayTeamId}`, logoUrl: away?.logoUrl ?? null }} error={fields.awayTeamId} />
        <div className="grid gap-1">
          <input
            id={`${idBase}-kickoff`} type="datetime-local" name="kickoffAt" defaultValue={isoToMadridLocal(row.kickoffAt)} disabled={pending}
            aria-label={`Partido ${row.position}, inicio (hora de Madrid)`} aria-invalid={fields.kickoffAt ? true : undefined} className={`${panelControl} tabular-nums`}
          />
          {fields.kickoffAt && <p role="alert" className="text-meta text-danger">{fields.kickoffAt}</p>}
        </div>
        <div className="grid gap-1">
          <input
            id={`${idBase}-comp`} name="competition" maxLength={200} autoComplete="off" defaultValue={row.competition ?? ""} disabled={pending} placeholder="Competición"
            aria-label={`Partido ${row.position}, competición`} aria-invalid={fields.competition ? true : undefined} className={panelControl}
          />
          {fields.competition && <p role="alert" className="text-meta text-danger">{fields.competition}</p>}
        </div>
        <PanelButton type="submit" variant="primary" loading={pending} aria-label={`Guardar partido ${row.position}`}>Guardar</PanelButton>
        <p className="text-meta text-fg-muted md:col-start-2 md:col-end-4">
          <span className="md:hidden">{row.position}. </span>Origen: {row.homeRaw} — {row.awayRaw}
        </p>
        <ActionMessage state={state} className="text-meta md:col-start-4 md:col-end-7" />
      </form>
    </li>
  );
}
