import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createAuthGateway } = require("../build/tests/features/auth/infrastructure/http-auth-gateway.js");
const { login } = require("../build/tests/features/auth/application/login.js");
const { ServiceError, safeMessage } = require("../build/tests/lib/http/errors.js");
const { isRouteId } = require("../build/tests/lib/route-id.js");
const { apiBaseUrl } = require("../build/tests/features/auth/server/config.js");
const user = { id: 42, email: "player@example.com", display_name: "Player", avatar_url: null, is_active: true, created_at: "2026-10-04T12:00:00Z" };
const session = { access_token: "test.token.value", token_type: "bearer", user };
const credentials = { email: user.email, password: "secret" };
const response = (payload, status = 200) => new Response(JSON.stringify(payload), { status });
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof ServiceError && error.code === code && !error.message.includes("private-detail"));

test("login maps the documented wire contract and sends no-cache JSON", async () => {
  let request;
  const gateway = createAuthGateway("https://api.example.com", async (url, init) => { request = { url, init }; return response(session); });
  const result = await login(gateway, { ...credentials, email: ` ${credentials.email} ` });
  assert.equal(result.user.id, "42");
  assert.equal(result.user.displayName, "Player");
  assert.equal(result.accessToken, session.access_token);
  assert.equal(result.user.display_name, undefined);
  assert.equal(request.url, "https://api.example.com/auth/login");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.cache, "no-store");
  assert.equal(request.init.redirect, "error");
  assert.deepEqual(JSON.parse(request.init.body), credentials);
});

test("invalid credentials input never calls the gateway", async () => {
  let called = false;
  await rejectsCode(login({ login: async () => { called = true; } }, { email: "bad", password: "" }), "validation");
  assert.equal(called, false);
});

test("inactive accounts cannot establish a session", async () => {
  await rejectsCode(login(createAuthGateway("https://api.example.com", async () => response({ ...session, user: { ...user, is_active: false } })), credentials), "credentials");
});

test("current user sends bearer only to server-side API and maps user", async () => {
  const gateway = createAuthGateway("https://api.example.com", async (url, init) => {
    assert.equal(url, "https://api.example.com/auth/me");
    assert.equal(init.headers.Authorization, "Bearer opaque");
    return response(user);
  });
  assert.equal((await gateway.currentUser("opaque")).id, "42");
});

for (const [status, code] of [[401, "credentials"], [403, "credentials"], [400, "validation"], [422, "validation"], [429, "rate-limit"], [500, "upstream"], [502, "upstream"]]) {
  test(`login normalizes HTTP ${status} without exposing backend details`, async () => {
    const gateway = createAuthGateway("https://api.example.com", async () => response({ detail: "private-detail" }, status));
    await rejectsCode(gateway.login(credentials), code);
  });
}

test("expired sessions are distinct from backend outages", async () => {
  const gateway = createAuthGateway("https://api.example.com", async () => response({}, 401));
  await rejectsCode(gateway.currentUser("opaque"), "unauthenticated");
});

for (const payload of [{}, { ...session, token_type: "other" }, { ...session, user: { ...user, id: "42" } }, { ...session, access_token: "bad\r\ntoken" }, { ...session, user: { ...user, id: Number.MAX_SAFE_INTEGER + 1 } }]) {
  test("malformed success payload is rejected", async () => {
    await rejectsCode(createAuthGateway("https://api.example.com", async () => response(payload)).login(credentials), "malformed");
  });
}

test("invalid JSON does not escape the transport boundary", async () => {
  await rejectsCode(createAuthGateway("https://api.example.com", async () => new Response("<html>private-detail</html>")).login(credentials), "malformed");
});

test("network failure is safe", async () => {
  await rejectsCode(createAuthGateway("https://api.example.com", async () => { throw new Error("private-detail"); }).login(credentials), "network");
  assert.equal(safeMessage(new Error("private-detail")), "El servicio no está disponible por ahora. Inténtalo de nuevo.");
});

test("timeout aborts the in-flight request", async () => {
  const fetcher = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
  await rejectsCode(createAuthGateway("https://api.example.com", fetcher, 5).login(credentials), "timeout");
});

test("route IDs reject noncanonical and unsafe integers", () => {
  for (const id of ["0", "-1", "abc", "01", "1.2", "9007199254740992"]) assert.equal(isRouteId(id), false);
  assert.equal(isRouteId("42"), true);
});

test("API configuration fails closed and strips trailing slash", () => {
  const previous = process.env.API_BASE_URL;
  try {
    delete process.env.API_BASE_URL;
    assert.throws(apiBaseUrl, error => error.code === "configuration");
    process.env.API_BASE_URL = "https://api.example.com/";
    assert.equal(apiBaseUrl(), "https://api.example.com");
    for (const value of ["file:///tmp/api", "https://user:secret@api.example.com", "https://api.example.com/?token=secret"]) {
      process.env.API_BASE_URL = value;
      assert.throws(apiBaseUrl, error => error.code === "configuration");
    }
  } finally {
    if (previous === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = previous;
  }
});
