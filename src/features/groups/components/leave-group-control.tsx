"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/ui/status-message";
import { leaveGroupAction } from "../server/actions";
import { initialFormState } from "../application/groups";

/** Leaving is irreversible from here, so it goes through a confirmation sheet. */
export function LeaveGroupControl({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [state, action] = useActionState(leaveGroupAction.bind(null, groupId), initialFormState);
  return (
    <Card as="section" aria-labelledby="leave-heading" header={<h2 id="leave-heading">Salir de la peña</h2>}>
      <p className="text-label text-fg-muted">Perderás el acceso a esta peña hasta que alguien te vuelva a compartir su código.</p>
      <ConfirmSheet
        triggerLabel="Salir de la peña"
        title={`¿Salir de ${groupName}?`}
        description="Dejarás de ver la peña y tus pronósticos en ella. Para volver necesitarás el código."
        confirmLabel="Sí, salir de la peña"
        cancelLabel="Quedarme"
        action={action}
        error={state.error || undefined}
      />
      <Reveal>{state.error && <StatusMessage tone="error">{state.error}</StatusMessage>}</Reveal>
    </Card>
  );
}
