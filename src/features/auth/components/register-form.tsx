"use client";

import { useActionState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { AppLink } from "@/components/shell/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { StatusMessage } from "@/components/ui/status-message";
import { TextInput } from "@/components/ui/text-input";
import { registerAction } from "../server/actions";
import { DISPLAY_NAME_MAX, EMAIL_MAX, initialRegisterState, PASSWORD_MAX, PASSWORD_MIN } from "../domain/register";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialRegisterState);
  const { fields, values } = state;
  return (
    <Card as="section" padding="lg">
      <form action={action} aria-describedby={state.error ? "register-status" : undefined} noValidate className="grid gap-4">
        <fieldset disabled={pending} className="m-0 grid min-w-0 gap-4 border-0 p-0">
          <Field id="displayName" label="Nombre visible" required error={fields.displayName}>
            {(control) => (
              <TextInput {...control} name="displayName" autoComplete="nickname" maxLength={DISPLAY_NAME_MAX} defaultValue={values.displayName} />
            )}
          </Field>
          <Field id="email" label="Correo electrónico" required error={fields.email}>
            {(control) => (
              <TextInput {...control} name="email" type="email" autoComplete="email" inputMode="email" maxLength={EMAIL_MAX} defaultValue={values.email} />
            )}
          </Field>
          <Field id="password" label="Contraseña" required error={fields.password}
            hint={fields.password ? undefined : `Al menos ${PASSWORD_MIN} caracteres.`}>
            {(control) => (
              <PasswordInput {...control} name="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} />
            )}
          </Field>
          <Field id="confirmPassword" label="Repite la contraseña" required error={fields.confirmPassword}>
            {(control) => (
              <PasswordInput {...control} name="confirmPassword" autoComplete="new-password" maxLength={PASSWORD_MAX} />
            )}
          </Field>
          <Button type="submit" size="lg" fullWidth loading={pending}>{pending ? "Creando cuenta…" : "Crear cuenta"}</Button>
        </fieldset>
        <Reveal live={false} className="[--reveal-gap:1rem]">
          {state.error && !pending && (
            <StatusMessage tone="error" id="register-status">
              {state.error}
              {state.emailTaken && <> <AppLink href="/login" indicator={false} className="fx-link font-bold">Iniciar sesión</AppLink></>}
            </StatusMessage>
          )}
        </Reveal>
      </form>
    </Card>
  );
}
