"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CodeInput } from "@/components/ui/code-input";
import { Field } from "@/components/ui/field";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/ui/status-message";
import { joinGroupAction } from "../server/actions";
import { initialFormState } from "../application/groups";
import { JOIN_CODE_MAX } from "../domain/groups";

export function JoinGroupForm() {
  const [state, action, pending] = useActionState(joinGroupAction, initialFormState);
  return (
    <Card as="div" padding="lg">
      <form action={action} noValidate className="grid gap-4">
        <Field id="joinCode" label="Código de la peña" required error={state.fields.joinCode}
          hint="Pídeselo a un admin de la peña. No distingue entre mayúsculas y minúsculas.">
          {(control) => (
            <CodeInput {...control} name="joinCode" maxLength={JOIN_CODE_MAX + 4}
              defaultValue={state.values.joinCode} disabled={pending} />
          )}
        </Field>
        <Reveal>{state.error && <StatusMessage tone="error">{state.error}</StatusMessage>}</Reveal>
        <Button type="submit" size="lg" fullWidth loading={pending}>Unirme a la peña</Button>
      </form>
    </Card>
  );
}
