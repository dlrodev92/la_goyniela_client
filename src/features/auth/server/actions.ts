"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login } from "../application/login";
import { register } from "../application/register";
import { initialRegisterState, type RegisterState } from "../domain/register";
import { createAuthGateway } from "../infrastructure/http-auth-gateway";
import { safeMessage, ServiceError } from "../../../lib/http/errors";
import { apiBaseUrl } from "./config";
import { SESSION_COOKIE, cookieOptions, setSessionCookie } from "./session";

export async function loginAction(_previous: { error: string }, formData: FormData): Promise<{ error: string }> {
  try {
    const session = await login(createAuthGateway(apiBaseUrl()), {
      email: formData.get("email"), password: formData.get("password"),
    });
    await setSessionCookie(session.accessToken);
  } catch (error) { return { error: safeMessage(error) }; }
  redirect("/dashboard");
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function registerAction(_previous: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = { displayName: text(formData, "displayName"), email: text(formData, "email") };
  try {
    const result = await register(createAuthGateway(apiBaseUrl()), { ...values, password: text(formData, "password"), confirmPassword: text(formData, "confirmPassword") });
    if (!result.ok) return { ...initialRegisterState, fields: result.fields, values };
    await setSessionCookie(result.session.accessToken);
  } catch (error) {
    // Framework control-flow errors and bugs must not become form messages.
    if (!(error instanceof ServiceError)) throw error;
    return { ...initialRegisterState, error: safeMessage(error), emailTaken: error.code === "email-taken", values };
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  (await cookies()).set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  redirect("/login");
}
