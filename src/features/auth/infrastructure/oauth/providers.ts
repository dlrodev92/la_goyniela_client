import "server-only";
import { z } from "zod";
import type { OAuthProvider, OAuthProviderId } from "../../domain/oauth";
import { ServiceError } from "../../../../lib/http/errors";

export type ProviderCredentials = { clientId: string; clientSecret: string };

const googleTokenSchema = z.object({ id_token: z.string().min(1).max(8192) });
const xTokenSchema = z.object({
  access_token: z.string().min(1).max(4096),
  token_type: z.string().optional(),
});

const TIMEOUT_MS = 8000;

async function postToken<T>(url: string, init: { headers: Record<string, string>; body: URLSearchParams }, schema: z.ZodType<T>, fetcher: typeof fetch): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST", body: init.body, cache: "no-store", redirect: "error",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch { throw new ServiceError("network"); }
  // The provider's error body is never read or surfaced.
  // 5xx = the provider is down; any other failure = it rejected the code.
  if (response.status >= 500) throw new ServiceError("provider-down");
  if (!response.ok) throw new ServiceError("provider");
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ServiceError("malformed"); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ServiceError("malformed");
  return parsed.data;
}

export function createGoogleProvider({ clientId, clientSecret }: ProviderCredentials, fetcher: typeof fetch = fetch): OAuthProvider {
  return {
    id: "google",
    buildAuthorizationUrl({ state, codeChallenge, redirectUri }) {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile",
        state, code_challenge: codeChallenge, code_challenge_method: "S256", prompt: "select_account",
      }).toString();
      return url;
    },
    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const body = new URLSearchParams({
        grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: codeVerifier,
        client_id: clientId, client_secret: clientSecret,
      });
      return (await postToken("https://oauth2.googleapis.com/token", { headers: {}, body }, googleTokenSchema, fetcher)).id_token;
    },
  };
}

export function createXProvider({ clientId, clientSecret }: ProviderCredentials, fetcher: typeof fetch = fetch): OAuthProvider {
  return {
    id: "x",
    buildAuthorizationUrl({ state, codeChallenge, redirectUri }) {
      const url = new URL("https://x.com/i/oauth2/authorize");
      url.search = new URLSearchParams({
        response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: "users.read tweet.read",
        state, code_challenge: codeChallenge, code_challenge_method: "S256",
      }).toString();
      return url;
    },
    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const basic = Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64");
      const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: codeVerifier });
      return (await postToken("https://api.x.com/2/oauth2/token", { headers: { Authorization: `Basic ${basic}` }, body }, xTokenSchema, fetcher)).access_token;
    },
  };
}

export function createOAuthProvider(id: OAuthProviderId, credentials: ProviderCredentials, fetcher: typeof fetch = fetch): OAuthProvider {
  return id === "google" ? createGoogleProvider(credentials, fetcher) : createXProvider(credentials, fetcher);
}
