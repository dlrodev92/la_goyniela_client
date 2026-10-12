import { z } from "zod";
import type { AuthGateway, Session } from "../domain/auth";
import {
  DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, EMAIL_MAX, PASSWORD_MAX, PASSWORD_MIN, PASSWORD_MISMATCH_MESSAGE, type RegisterFieldErrors,
} from "../domain/register";

const registrationSchema = z.object({
  displayName: z.string().trim()
    .min(DISPLAY_NAME_MIN, `Usa al menos ${DISPLAY_NAME_MIN} caracteres.`)
    .max(DISPLAY_NAME_MAX, `Usa como máximo ${DISPLAY_NAME_MAX} caracteres.`),
  email: z.string().trim().email("Escribe un correo electrónico válido.").max(EMAIL_MAX, `Usa como máximo ${EMAIL_MAX} caracteres.`),
  password: z.string()
    .min(PASSWORD_MIN, `Usa al menos ${PASSWORD_MIN} caracteres.`)
    .max(PASSWORD_MAX, `Usa como máximo ${PASSWORD_MAX} caracteres.`),
});

export type RegisterResult = { ok: true; session: Session } | { ok: false; fields: RegisterFieldErrors };

/**
 * Validates locally first (same limits as the backend, so a 422 is unlikely) and reports per-field
 * messages; the gateway is never called with invalid input. Gateway failures throw ServiceError.
 */
export async function register(gateway: AuthGateway, input: { displayName: unknown; email: unknown; password: unknown; confirmPassword: unknown }): Promise<RegisterResult> {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const parsed = registrationSchema.safeParse({ displayName: text(input.displayName), email: text(input.email), password: text(input.password) });
  const fields: RegisterFieldErrors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof RegisterFieldErrors;
      fields[key] ??= issue.message;
    }
  }
  if (text(input.password) !== text(input.confirmPassword)) fields.confirmPassword = PASSWORD_MISMATCH_MESSAGE;
  if (!parsed.success || fields.confirmPassword) return { ok: false, fields };
  return { ok: true, session: await gateway.register(parsed.data) };
}
