/** Backend RegisterIn constraints (display_name 2..60 after trim, password 8..128, email stored in 120 chars). */
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 60;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const EMAIL_MAX = 120;

export const PASSWORD_MISMATCH_MESSAGE = "Las contraseñas no coinciden.";

export type RegisterField = "displayName" | "email" | "password" | "confirmPassword";
export type RegisterFieldErrors = Partial<Record<RegisterField, string>>;

/** Action state: the password is never echoed back; `emailTaken` drives the "log in instead" link. */
export type RegisterState = {
  error: string;
  emailTaken: boolean;
  fields: RegisterFieldErrors;
  values: { displayName: string; email: string };
};
export const initialRegisterState: RegisterState = { error: "", emailTaken: false, fields: {}, values: { displayName: "", email: "" } };
