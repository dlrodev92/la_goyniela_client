"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/ui/status-message";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { createGroupAction } from "../server/actions";
import { initialFormState } from "../application/groups";
import { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX } from "../domain/groups";

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroupAction, initialFormState);
  return (
    <Card as="div" padding="lg">
      <form action={action} noValidate className="grid gap-4">
        <Field id="name" label="Nombre de la peña" required error={state.fields.name}>
          {(control) => (
            <TextInput {...control} name="name" autoComplete="off" maxLength={GROUP_NAME_MAX}
              defaultValue={state.values.name} disabled={pending} />
          )}
        </Field>
        <Field id="description" label="Descripción (opcional)" hint="Cuenta de qué va la peña." error={state.fields.description}>
          {(control) => (
            <TextArea {...control} name="description" rows={3} maxLength={GROUP_DESCRIPTION_MAX}
              defaultValue={state.values.description} disabled={pending} />
          )}
        </Field>
        <Reveal>{state.error && <StatusMessage tone="error">{state.error}</StatusMessage>}</Reveal>
        <Button type="submit" size="lg" fullWidth loading={pending}>Crear peña</Button>
        <p className="text-meta text-fg-muted">Serás admin de la peña y recibirás un código para invitar a tus amigos.</p>
      </form>
    </Card>
  );
}
