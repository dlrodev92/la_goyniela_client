"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { deleteGroupAction } from "../server/actions";
import { initialFormState } from "../application/groups";

/** Danger zone for the creator: a confirmation sheet that requires typing the exact group name. */
export function DeleteGroupControl({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [state, action] = useActionState(deleteGroupAction.bind(null, groupId), initialFormState);
  return (
    <Card as="section" tone="danger" aria-labelledby="delete-heading" header={<h2 id="delete-heading">Zona de peligro</h2>}>
      <p className="text-label text-fg-muted">Eliminar la peña la borra, junto con todas las pertenencias, para todos los miembros. No se puede deshacer.</p>
      <ConfirmSheet
        triggerLabel="Eliminar peña"
        triggerVariant="danger"
        title="¿Eliminar la peña?"
        description={<>Se eliminará <strong className="break-words text-fg">{groupName}</strong> para todos sus miembros. Esta acción no se puede deshacer.</>}
        confirmLabel="Sí, eliminar la peña"
        cancelLabel="Conservar"
        confirmText={{ expected: groupName, label: "Escribe el nombre de la peña para confirmar", name: "confirmName" }}
        action={action}
        error={state.fields.confirmName || state.error || undefined}
      />
    </Card>
  );
}
