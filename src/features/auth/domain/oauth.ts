export const OAUTH_PROVIDERS = ["google", "x"] as const;
export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProviderId(value: unknown): value is OAuthProviderId {
  return typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export type AuthorizationRequest = { state: string; codeChallenge: string; redirectUri: string };
export type CodeExchange = { code: string; codeVerifier: string; redirectUri: string };

/** Provider token returned to the server only: Google id_token or X access_token. */
export interface OAuthProvider {
  readonly id: OAuthProviderId;
  buildAuthorizationUrl(request: AuthorizationRequest): URL;
  exchangeCode(exchange: CodeExchange): Promise<string>;
}

/** Stable codes carried by /login?error=<code>. */
export const LOGIN_ERROR_CODES = ["oauth_denied", "oauth_state", "oauth_failed", "oauth_rejected", "provider_unavailable", "provider_down", "x_down"] as const;
export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

const loginErrorMessages: Record<LoginErrorCode, string> = {
  oauth_denied: "Cancelaste el inicio de sesión. Puedes intentarlo de nuevo cuando quieras.",
  oauth_state: "Tu sesión de acceso caducó o no se pudo verificar. Inténtalo de nuevo.",
  oauth_failed: "No hemos podido iniciar sesión con ese proveedor. Inténtalo de nuevo.",
  oauth_rejected: "El proveedor no ha aceptado tus credenciales. Inténtalo de nuevo.",
  provider_unavailable: "Esa opción de acceso no está disponible por ahora.",
  provider_down: "El servicio de acceso del proveedor no está disponible. Inténtalo más tarde.",
  x_down: "El servicio de X no está disponible. Inténtalo más tarde.",
};

/** Login error for a failed provider exchange: invalid credentials (401) vs the provider being down (502). */
export function loginErrorFor(provider: OAuthProviderId, failure: "credentials-rejected" | "provider-down" | "other"): LoginErrorCode {
  if (failure === "credentials-rejected") return "oauth_rejected";
  if (failure === "provider-down") return provider === "x" ? "x_down" : "provider_down";
  return "oauth_failed";
}

/** Returns null when there is no error, a safe generic message for unknown codes. */
export function loginErrorMessage(code: unknown): string | null {
  if (code === undefined || code === null || code === "") return null;
  if (typeof code === "string" && (LOGIN_ERROR_CODES as readonly string[]).includes(code)) {
    return loginErrorMessages[code as LoginErrorCode];
  }
  return "Algo ha salido mal al iniciar sesión. Inténtalo de nuevo.";
}

export const providerLabels: Record<OAuthProviderId, string> = { google: "Google", x: "X" };
