import "server-only";
import { z } from "zod";
import { OAUTH_PROVIDERS, type OAuthProviderId } from "../domain/oauth";
import type { ProviderCredentials } from "../infrastructure/oauth/providers";

type Env = Record<string, string | undefined>;

const envNames: Record<OAuthProviderId, { id: string; secret: string }> = {
  google: { id: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET" },
  x: { id: "X_CLIENT_ID", secret: "X_CLIENT_SECRET" },
};
const credential = z.string().trim().min(1).max(512);

/** Public origin of this app, or null when missing or unsafe. */
export function appOrigin(env: Env = process.env): string | null {
  try {
    const url = new URL(env.APP_URL ?? "");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/") return null;
    if (env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

/** Credentials for a provider, or null when it is disabled (missing keys or APP_URL). */
export function providerCredentials(provider: OAuthProviderId, env: Env = process.env): ProviderCredentials | null {
  if (!appOrigin(env)) return null;
  const id = credential.safeParse(env[envNames[provider].id]);
  const secret = credential.safeParse(env[envNames[provider].secret]);
  return id.success && secret.success ? { clientId: id.data, clientSecret: secret.data } : null;
}

export const enabledProviders = (env: Env = process.env): OAuthProviderId[] =>
  OAUTH_PROVIDERS.filter((provider) => providerCredentials(provider, env) !== null);

export function redirectUri(provider: OAuthProviderId, env: Env = process.env): string | null {
  const origin = appOrigin(env);
  return origin ? `${origin}/auth/${provider}/callback` : null;
}
