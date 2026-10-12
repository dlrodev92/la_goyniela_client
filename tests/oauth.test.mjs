import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { codeChallengeS256, generateCodeVerifier, generateState, statesMatch, encodeTransient, decodeTransient } = require("../build/tests/features/auth/infrastructure/oauth/pkce.js");
const { createGoogleProvider, createXProvider } = require("../build/tests/features/auth/infrastructure/oauth/providers.js");
const { createAuthGateway } = require("../build/tests/features/auth/infrastructure/http-auth-gateway.js");
const { loginWithProvider } = require("../build/tests/features/auth/application/oauth-login.js");
const { loginErrorMessage, isOAuthProviderId } = require("../build/tests/features/auth/domain/oauth.js");
const { displayEmail } = require("../build/tests/features/auth/domain/auth.js");
const { providerCredentials, enabledProviders, redirectUri } = require("../build/tests/features/auth/server/oauth-config.js");
const { ServiceError } = require("../build/tests/lib/http/errors.js");

const creds = { clientId: "cid", clientSecret: "sec:ret" };
const redirect = "https://app.example.com/auth/google/callback";
const user = { id: 1, email: "p@example.com", display_name: "P", avatar_url: null, is_active: true, created_at: "2026-10-04T12:00:00Z" };
const session = { access_token: "jwt.token.value", token_type: "bearer", expires_in: 3600, user };
const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status });

test("PKCE S256 matches the RFC 7636 vector", () => {
  assert.equal(codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  assert.match(generateCodeVerifier(), /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(generateState(), generateState());
});

test("authorization URLs carry the documented params", () => {
  const request = { state: "s".repeat(43), codeChallenge: "chal", redirectUri: redirect };
  const g = createGoogleProvider(creds).buildAuthorizationUrl(request);
  assert.equal(g.origin + g.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(g.searchParams.get("scope"), "openid email profile");
  assert.equal(g.searchParams.get("code_challenge_method"), "S256");
  assert.equal(g.searchParams.get("response_type"), "code");
  assert.equal(g.searchParams.get("client_id"), "cid");
  assert.equal(g.searchParams.get("redirect_uri"), redirect);
  assert.equal(g.searchParams.get("state"), request.state);
  const x = createXProvider(creds).buildAuthorizationUrl(request);
  assert.equal(x.origin + x.pathname, "https://x.com/i/oauth2/authorize");
  assert.equal(x.searchParams.get("scope"), "users.read tweet.read");
  assert.equal(x.searchParams.get("code_challenge"), "chal");
  assert.equal(x.searchParams.get("client_secret"), null);
});

test("state comparison rejects mismatch, missing values and malformed cookies", () => {
  const state = generateState();
  assert.equal(statesMatch(state, state), true);
  assert.equal(statesMatch(state, generateState()), false);
  assert.equal(statesMatch(state, null), false);
  assert.equal(statesMatch(undefined, state), false);
  assert.equal(statesMatch("", ""), false);
  const verifier = generateCodeVerifier();
  assert.deepEqual(decodeTransient(encodeTransient(state, verifier)), { state, verifier });
  assert.equal(decodeTransient("garbage"), null);
  assert.equal(decodeTransient(undefined), null);
});

test("Google exchange posts the secret in the body and returns id_token", async () => {
  let call;
  const provider = createGoogleProvider(creds, async (url, init) => { call = { url, init }; return json({ id_token: "idt", access_token: "ignored" }); });
  assert.equal(await provider.exchangeCode({ code: "c", codeVerifier: "v", redirectUri: redirect }), "idt");
  assert.equal(call.url, "https://oauth2.googleapis.com/token");
  assert.equal(call.init.body.get("client_secret"), "sec:ret");
  assert.equal(call.init.body.get("code_verifier"), "v");
  assert.equal(call.init.body.get("grant_type"), "authorization_code");
});

test("X exchange uses Basic auth, no secret in body, returns access_token", async () => {
  let call;
  const provider = createXProvider(creds, async (url, init) => { call = { url, init }; return json({ access_token: "xat", token_type: "bearer" }); });
  assert.equal(await provider.exchangeCode({ code: "c", codeVerifier: "v", redirectUri: redirect }), "xat");
  assert.equal(call.url, "https://api.x.com/2/oauth2/token");
  assert.equal(call.init.headers.Authorization, `Basic ${Buffer.from("cid:sec%3Aret").toString("base64")}`);
  assert.equal(call.init.headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(call.init.body.get("client_secret"), null);
});

test("malformed or failed provider token responses are rejected without leaking", async () => {
  for (const payload of [{}, { id_token: "" }, { id_token: 5 }, []]) {
    await assert.rejects(createGoogleProvider(creds, async () => json(payload)).exchangeCode({ code: "c", codeVerifier: "v", redirectUri: redirect }), e => e instanceof ServiceError && e.code === "malformed");
  }
  await assert.rejects(createXProvider(creds, async () => json({ token_type: "bearer" })).exchangeCode({ code: "c", codeVerifier: "v", redirectUri: redirect }), e => e.code === "malformed");
  await assert.rejects(createXProvider(creds, async () => json({ error: "private-detail" }, 400)).exchangeCode({ code: "c", codeVerifier: "v", redirectUri: redirect }), e => e.code === "provider" && !e.message.includes("private-detail"));
});

test("gateway posts the right body to /auth/google and /auth/x", async () => {
  const calls = [];
  const gateway = createAuthGateway("https://api.example.com", async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return json(session); });
  const result = await loginWithProvider(gateway, "google", "idt");
  assert.equal(result.accessToken, "jwt.token.value");
  await loginWithProvider(gateway, "x", "xat");
  assert.deepEqual(calls, [
    { url: "https://api.example.com/auth/google", body: { id_token: "idt" } },
    { url: "https://api.example.com/auth/x", body: { access_token: "xat" } },
  ]);
});

test("provider login maps 401 to a safe provider error and rejects empty tokens", async () => {
  const gateway = createAuthGateway("https://api.example.com", async () => json({ detail: "private-detail" }, 401));
  await assert.rejects(loginWithProvider(gateway, "google", "t"), e => e.code === "provider" && !e.message.includes("private-detail"));
  await assert.rejects(loginWithProvider(gateway, "x", ""), e => e.code === "validation");
  const inactive = createAuthGateway("https://api.example.com", async () => json({ ...session, user: { ...user, is_active: false } }));
  await assert.rejects(loginWithProvider(inactive, "x", "t"), e => e.code === "provider");
});

test("error codes map to friendly messages with a generic fallback", () => {
  assert.equal(loginErrorMessage(undefined), null);
  for (const code of ["oauth_denied", "oauth_state", "oauth_failed", "provider_unavailable"]) assert.ok(loginErrorMessage(code).length > 10);
  assert.match(loginErrorMessage("<script>"), /Algo ha salido mal/);
  assert.equal(isOAuthProviderId("google"), true);
  assert.equal(isOAuthProviderId("github"), false);
});

test("providers are disabled when credentials or APP_URL are missing", () => {
  const env = { APP_URL: "https://app.example.com", GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", X_CLIENT_ID: "c", X_CLIENT_SECRET: " " };
  assert.deepEqual(enabledProviders(env), ["google"]);
  assert.equal(providerCredentials("x", env), null);
  assert.equal(redirectUri("google", env), "https://app.example.com/auth/google/callback");
  assert.deepEqual(enabledProviders({ ...env, APP_URL: undefined }), []);
  assert.deepEqual(enabledProviders({ ...env, APP_URL: "https://app.example.com/path" }), []);
  assert.deepEqual(enabledProviders({}), []);
});

test("X placeholder emails are never displayed", () => {
  assert.equal(displayEmail({ email: "x_123@x.placeholder" }), null);
  assert.equal(displayEmail({ email: "p@example.com" }), "p@example.com");
});
