"use client";

import { GENDERS, TEAM_ENTITY_MAX, TEAM_NAME_MAX } from "../application/forms";
import type { ActionState, AdminTeam } from "../domain/admin";
import { ActionMessage } from "./action-message";
import { PField, PanelButton, panelControl } from "./panel-ui";

/** Compact create/edit form of one team, laid out in a dense grid. `team` seeds the edit form; ids are namespaced per form. */
export function TeamForm({ idPrefix, team, state, action, pending, onCancel }: {
  idPrefix: string; team?: AdminTeam; state: ActionState; action: (formData: FormData) => void; pending: boolean; onCancel: () => void;
}) {
  const fields = state.fields ?? {};
  const invalid = (key: string) => (fields[key] ? true : undefined);
  return (
    <form action={action} noValidate onKeyDown={event => { if (event.key === "Escape") onCancel(); }} className="grid gap-3 p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!team && (
          <PField id={`${idPrefix}-entity`} label="Identificador (slug) *" error={fields.entityId} hint="Único; no se puede cambiar después.">
            <input id={`${idPrefix}-entity`} name="entityId" maxLength={TEAM_ENTITY_MAX} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="club-men-fc-barcelona" aria-invalid={invalid("entityId")} className={panelControl} />
          </PField>
        )}
        <PField id={`${idPrefix}-name`} label="Nombre *" error={fields.name}>
          <input id={`${idPrefix}-name`} name="name" maxLength={TEAM_NAME_MAX} autoComplete="off" defaultValue={team?.name} aria-invalid={invalid("name")} className={panelControl} />
        </PField>
        <PField id={`${idPrefix}-short`} label="Nombre corto" error={fields.shortName}>
          <input id={`${idPrefix}-short`} name="shortName" autoComplete="off" defaultValue={team?.shortName ?? ""} aria-invalid={invalid("shortName")} className={panelControl} />
        </PField>
        <PField id={`${idPrefix}-gender`} label="Género" error={fields.gender}>
          <select id={`${idPrefix}-gender`} name="gender" defaultValue={team?.gender ?? ""} aria-invalid={invalid("gender")} className={panelControl}>
            <option value="">Sin indicar</option>
            {GENDERS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </PField>
        <PField id={`${idPrefix}-country`} label="País (3 letras)" error={fields.country}>
          <input id={`${idPrefix}-country`} name="country" maxLength={3} autoComplete="off" autoCapitalize="characters" placeholder="ESP" defaultValue={team?.country ?? ""} aria-invalid={invalid("country")} className={panelControl} />
        </PField>
        <PField id={`${idPrefix}-competition`} label="Competición *" error={fields.competitionId}>
          <input id={`${idPrefix}-competition`} name="competitionId" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="laliga-ea-sports" defaultValue={team?.competitionId} aria-invalid={invalid("competitionId")} className={panelControl} />
        </PField>
        <PField id={`${idPrefix}-logo-url`} label="URL del escudo" error={fields.logoUrl} className="sm:col-span-2">
          <input id={`${idPrefix}-logo-url`} type="url" name="logoUrl" autoComplete="off" spellCheck={false} defaultValue={team?.logoUrl ?? ""} aria-invalid={invalid("logoUrl")} className={panelControl} />
        </PField>
        {team && (
          <PField id={`${idPrefix}-logo`} label="Subir escudo (PNG, JPEG o WebP, 5 MB)" error={fields.logo} hint="Sustituye a la URL. Requiere ser admin de alguna peña.">
            <input id={`${idPrefix}-logo`} type="file" name="logo" accept="image/png,image/jpeg,image/webp" aria-invalid={invalid("logo")} className={`${panelControl} h-auto py-1 file:mr-2 file:rounded file:border-0 file:bg-surface-3 file:px-2 file:py-0.5 file:text-label file:text-fg`} />
          </PField>
        )}
        <label className="flex items-center gap-2 text-label sm:self-end sm:pb-1.5">
          <input type="checkbox" name="genderKnown" defaultChecked={team?.genderKnown ?? true} className="size-4 accent-(--color-action)" />
          El género es conocido
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PanelButton type="submit" variant="primary" loading={pending}>{team ? "Guardar equipo" : "Crear equipo"}</PanelButton>
        <PanelButton variant="ghost" onClick={onCancel} disabled={pending}>Cancelar</PanelButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
