"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/ui/status-message";
import { memberAdminAction } from "../server/actions";
import { initialFormState } from "../application/groups";
import type { MemberAction } from "../domain/groups";

/** Admin controls for one member row. Role changes submit directly; removal goes through a confirmation sheet. */
export function MemberAdminControls({ groupId, userId, displayName, actions }: {
  groupId: string; userId: string; displayName: string; actions: MemberAction[];
}) {
  const [state, action, pending] = useActionState(memberAdminAction.bind(null, groupId, userId), initialFormState);
  const toggle = actions.find(item => item === "promote" || item === "demote");
  const name = displayName || "este miembro";
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2 *:flex-1 *:basis-32">
        {toggle && (
          <form action={action} className="contents">
            <Button type="submit" variant="secondary" name="intent" value={toggle} loading={pending}
              aria-label={`${toggle === "promote" ? "Hacer admin a" : "Quitar admin a"} ${name}`}>
              {toggle === "promote" ? "Hacer admin" : "Quitar admin"}
            </Button>
          </form>
        )}
        {actions.includes("remove") && (
          <ConfirmSheet
            triggerLabel="Expulsar"
            triggerAriaLabel={`Expulsar a ${name} de la peña`}
            title={`¿Expulsar a ${name}?`}
            description="Sus pronósticos en esta peña dejarán de contar. Podrá volver a unirse si tiene el código."
            confirmLabel="Sí, expulsar"
            cancelLabel="Mantener"
            action={action}
            error={state.error || undefined}
          >
            <input type="hidden" name="intent" value="remove" />
          </ConfirmSheet>
        )}
      </div>
      <Reveal>{state.error && <StatusMessage tone="error">{state.error}</StatusMessage>}</Reveal>
    </div>
  );
}
