"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Field } from "@/components/ui/field";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/ui/status-message";
import { TextInput } from "@/components/ui/text-input";
import { formatEuro } from "@/lib/format-money";
import { budgetText } from "../../domain/logic";
import { specFields, specOf } from "../../domain/modes";
import { columnsLabel, porraFormatLabel, porraTotals } from "../../domain/porra-view";
import type { Porra } from "../../domain/porras";
import { deleteBoletoAction, updatePorraAction, type AdminFormState } from "../../server/actions";
import { ModeChooser, type ModeSelection } from "./mode-chooser";

const idle: AdminFormState = { status: "idle", message: "" };

/**
 * "Ajustes de la porra" (admin, open porra): the current terms, a sheet to change budget and format, and, once the peña has
 * a boleto, a budget-only sheet plus the way to delete the boleto so the format can change.
 */
export function PorraSettings({ groupId, porra }: { groupId: string; porra: Porra }) {
  const [formatState, formatAction] = useActionState(updatePorraAction.bind(null, groupId, porra.id), idle);
  const [budgetState, budgetAction] = useActionState(updatePorraAction.bind(null, groupId, porra.id), idle);
  const [deleteState, deleteAction] = useActionState(async () => deleteBoletoAction(groupId, porra.id), idle);
  const [selection, setSelection] = useState<ModeSelection | null>(null);
  const totals = porraTotals(porra);
  const cost = formatEuro(totals.costEur, { fixed: true });
  const message = [formatState, budgetState, deleteState].find(state => state.status === "saved");
  return (
    <Card as="section" surface={1} aria-labelledby="porra-settings-heading" header={<h2 id="porra-settings-heading">Ajustes de la porra</h2>}>
      <p className="text-label text-fg-muted">
        {porraFormatLabel(porra)} · {columnsLabel(totals.columns)} · {cost} de {formatEuro(porra.budgetEur, { fixed: true })}.
      </p>
      {porra.hasBoleto ? (
        <>
          <p className="text-label text-fg-muted">La peña ya ha confirmado su boleto. Puedes cambiar el presupuesto; para cambiar el formato hay que borrar antes el boleto.</p>
          <ConfirmSheet
            triggerLabel="Cambiar presupuesto"
            triggerAriaLabel="Cambiar el presupuesto de la porra"
            title="Cambiar presupuesto"
            description={`El nuevo presupuesto tiene que cubrir el coste del boleto: ${cost}.`}
            confirmLabel="Guardar presupuesto"
            tone="default"
            action={budgetAction}
            error={budgetState.status === "error" ? budgetState.message : undefined}
            closeKey={budgetState.status === "saved" ? budgetState : null}
          >
            <Field id="porra-budget" label="Presupuesto en euros">
              {control => <TextInput {...control} name="budget" inputMode="decimal" autoComplete="off" defaultValue={budgetText(porra.budgetEur)} />}
            </Field>
          </ConfirmSheet>
          <ConfirmSheet
            triggerLabel="Borrar boleto para cambiar el formato"
            title="Borrar el boleto de la peña"
            description="Se borra el boleto confirmado. Los votos de los miembros se conservan. Después podrás cambiar el formato y confirmar un boleto nuevo."
            confirmLabel="Borrar boleto"
            tone="danger"
            action={deleteAction}
            error={deleteState.status === "error" ? deleteState.message : undefined}
            closeKey={deleteState.status === "saved" ? deleteState : null}
          />
        </>
      ) : (
        <ConfirmSheet
          triggerLabel="Cambiar formato"
          triggerAriaLabel="Cambiar el presupuesto y el formato de la porra"
          title="Cambiar formato"
          description="Elige el presupuesto, el modo y una opción que quepa. Los miembros no necesitan volver a votar."
          confirmLabel="Guardar formato"
          cancelLabel="Cancelar"
          tone="default"
          action={formatAction}
          error={formatState.status === "error" ? formatState.message : undefined}
          confirmDisabled={selection === null}
          closeKey={formatState.status === "saved" ? formatState : null}
        >
          <ModeChooser groupId={groupId} jornadaId={porra.jornadaId} initialBudget={budgetText(porra.budgetEur)} current={specOf(porra)} onSelect={setSelection} />
          {selection && (
            <>
              <input type="hidden" name="budget" value={selection.budgetEur} />
              {Object.entries(specFields(selection.spec)).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            </>
          )}
        </ConfirmSheet>
      )}
      <Reveal>{message && <StatusMessage tone="success">{message.message}</StatusMessage>}</Reveal>
    </Card>
  );
}
