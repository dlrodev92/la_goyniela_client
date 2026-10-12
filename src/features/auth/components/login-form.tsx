"use client";

import { useActionState, useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { StatusMessage } from "@/components/ui/status-message";
import { TextInput } from "@/components/ui/text-input";
import { loginAction } from "../server/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, { error: "" });
  // The form resets after every action; keep the email so a wrong password only means retyping the password.
  const [email, setEmail] = useState("");
  const action = (formData: FormData) => {
    const value = formData.get("email");
    if (typeof value === "string") setEmail(value);
    return formAction(formData);
  };
  return (
    <Card as="section" padding="lg">
      <form action={action} aria-describedby={state.error ? "login-status" : undefined} className="grid gap-4">
        <fieldset disabled={pending} className="m-0 grid min-w-0 gap-4 border-0 p-0">
          <Field id="email" label="Correo electrónico" required>
            {(control) => (
              <TextInput {...control} name="email" type="email" autoComplete="email" inputMode="email" maxLength={254}
                value={email} onChange={(event) => setEmail(event.target.value)} />
            )}
          </Field>
          <Field id="password" label="Contraseña" required>
            {(control) => <PasswordInput {...control} name="password" autoComplete="current-password" maxLength={1024} />}
          </Field>
          <Button type="submit" size="lg" fullWidth loading={pending}>{pending ? "Entrando…" : "Iniciar sesión"}</Button>
        </fieldset>
        <Reveal live={false} className="[--reveal-gap:1rem]">{state.error && !pending && <StatusMessage tone="error" id="login-status">{state.error}</StatusMessage>}</Reveal>
      </form>
    </Card>
  );
}
