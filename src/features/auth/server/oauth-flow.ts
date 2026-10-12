import "server-only";
import { cookies } from "next/headers";
import { loginErrorFor, type LoginErrorCode, type OAuthProviderId } from "../domain/oauth";
import { ServiceError } from "../../../lib/http/errors";
import { loginWithProvider } from "../application/oauth-login";
import { createAuthGateway } from "../infrastructure/http-auth-gateway";
import { codeChallengeS256, decodeTransient, encodeTransient, generateCodeVerifier, generateState, statesMatch } from "../infrastructure/oauth/pkce";
import { createOAuthProvider } from "../infrastructure/oauth/providers";
import { apiBaseUrl } from "./config";
import { providerCredentials, redirectUri } from "./oauth-config";
import { setSessionCookie } from "./session";

/** Outcome of a flow step: an absolute URL (provider) or an app-relative path. */
export type FlowResult = { to: string; external: boolean };
const toLogin = (error: LoginErrorCode): FlowResult => ({ to: `/login?error=${error}`, external: false });

const TRANSIENT_MAX_AGE = 60 * 10;
const transientName = (provider: OAuthProviderId) => `goyniela_oauth_${provider}`;
const transientOptions = (provider: OAuthProviderId) => ({
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: `/auth/${provider}`,
});

export async function startOAuth(provider: OAuthProviderId): Promise<FlowResult> {
  const credentials = providerCredentials(provider);
  const callback = redirectUri(provider);
  if (!credentials || !callback) return toLogin("provider_unavailable");
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = createOAuthProvider(provider, credentials).buildAuthorizationUrl({
    state, codeChallenge: codeChallengeS256(verifier), redirectUri: callback,
  });
  (await cookies()).set(transientName(provider), encodeTransient(state, verifier), { ...transientOptions(provider), maxAge: TRANSIENT_MAX_AGE });
  return { to: url.toString(), external: true };
}

export async function completeOAuth(provider: OAuthProviderId, params: URLSearchParams): Promise<FlowResult> {
  const jar = await cookies();
  const transient = decodeTransient(jar.get(transientName(provider))?.value);
  // Single-use: always drop the transient cookie, whatever happens next.
  jar.set(transientName(provider), "", { ...transientOptions(provider), maxAge: 0 });

  if (params.has("error")) return toLogin("oauth_denied");
  const state = params.get("state");
  const code = params.get("code");
  if (!transient || !statesMatch(transient.state, state)) return toLogin("oauth_state");
  if (!code) return toLogin("oauth_failed");

  const credentials = providerCredentials(provider);
  const callback = redirectUri(provider);
  if (!credentials || !callback) return toLogin("provider_unavailable");
  try {
    const providerToken = await createOAuthProvider(provider, credentials).exchangeCode({ code, codeVerifier: transient.verifier, redirectUri: callback });
    const session = await loginWithProvider(createAuthGateway(apiBaseUrl()), provider, providerToken);
    await setSessionCookie(session.accessToken);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "configuration") return toLogin("provider_unavailable");
    if (error instanceof ServiceError && error.code === "provider") return toLogin(loginErrorFor(provider, "credentials-rejected"));
    if (error instanceof ServiceError && error.code === "provider-down") return toLogin(loginErrorFor(provider, "provider-down"));
    return toLogin(loginErrorFor(provider, "other"));
  }
  return { to: "/dashboard", external: false };
}
