import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createAuthGateway } = require("../build/tests/features/auth/infrastructure/http-auth-gateway.js");
const { register } = require("../build/tests/features/auth/application/register.js");
const { ServiceError, safeMessage } = require("../build/tests/lib/http/errors.js");

const BASE = "https://api.example.com";
// Real backend UserOut: no is_active / created_at, but auth_providers.
const user = { id: 7, email: "new@example.com", display_name: "Newbie", avatar_url: null, auth_providers: ["local"] };
const tokenOut = { access_token: "test.token.value", token_type: "Bearer", expires_in: 86400, user };
const input = { displayName: "  Newbie ", email: " new@example.com ", password: "correct horse", confirmPassword: "correct horse" };
const response = (payload, status = 200) => new Response(JSON.stringify(payload), { status });
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof ServiceError && error.code === code && !error.message.includes("private-detail"));

test("register posts the backend body shape and maps the 201 session", async () => {
  let request;
  const gateway = createAuthGateway(BASE, async (url, init) => { request = { url, init }; return response(tokenOut, 201); });
  const result = await register(gateway, input);
  assert.equal(result.ok, true);
  assert.equal(request.url, `${BASE}/auth/register`);
  assert.equal(request.init.method, "POST");
  assert.deepEqual(JSON.parse(request.init.body), { email: "new@example.com", password: "correct horse", display_name: "Newbie" });
  assert.equal(result.session.accessToken, "test.token.value");
  assert.equal(result.session.user.id, "7");
  assert.equal(result.session.user.isActive, true);
  assert.equal(result.session.user.createdAt, null);
});

test("409 maps to email-taken with a friendly message that never echoes the backend detail", async () => {
  const gateway = createAuthGateway(BASE, async () => response({ detail: "email='new@example.com' already registered private-detail" }, 409));
  await rejectsCode(register(gateway, input), "email-taken");
  assert.equal(safeMessage(new ServiceError("email-taken")), "Ya existe una cuenta con ese correo.");
});

test("backend 422 maps to a validation error", async () => {
  const gateway = createAuthGateway(BASE, async () => response({ detail: [{ loc: ["body", "email"], msg: "private-detail" }] }, 422));
  await rejectsCode(register(gateway, input), "validation");
});

test("invalid input returns per-field errors and never calls the gateway", async () => {
  const gateway = { register: async () => assert.fail("called") };
  const result = await register(gateway, { displayName: "A", email: "nope", password: "short", confirmPassword: "short" });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.fields).sort(), ["displayName", "email", "password"]);
  const long = await register(gateway, { displayName: "x".repeat(61), email: "a@b.co", password: "x".repeat(129), confirmPassword: "x".repeat(129) });
  assert.deepEqual(Object.keys(long.fields).sort(), ["displayName", "password"]);
  const wrongTypes = await register(gateway, { displayName: null, email: undefined, password: 12345678, confirmPassword: 12345678 });
  assert.equal(wrongTypes.ok, false);
});

test("a whitespace-only display name is rejected after trimming", async () => {
  const result = await register({ register: async () => assert.fail("called") }, { ...input, displayName: "   " });
  assert.equal(result.ok, false);
  assert.ok(result.fields.displayName);
});

test("malformed register responses are rejected", async () => {
  for (const payload of [{ ...tokenOut, access_token: "" }, { ...tokenOut, user: { ...user, email: "bad" } }, { user }]) {
    await rejectsCode(register(createAuthGateway(BASE, async () => response(payload, 201)), input), "malformed");
  }
});

test("the user schema accepts both the real backend shape and the documented one", async () => {
  const documented = { ...user, is_active: true, created_at: "2026-10-04T12:00:00Z" };
  const result = await register(createAuthGateway(BASE, async () => response({ ...tokenOut, user: documented }, 201)), input);
  assert.equal(result.session.user.createdAt, "2026-10-04T12:00:00Z");
});

test("register rejects mismatching passwords before calling the backend and never echoes them", async () => {
  let called = false;
  const gateway = createAuthGateway(BASE, async () => { called = true; return response(tokenOut, 201); });
  const result = await register(gateway, { ...input, confirmPassword: "correct horse!" });
  assert.equal(result.ok, false);
  assert.deepEqual(result.fields, { confirmPassword: "Las contraseñas no coinciden." });
  assert.equal(called, false);
  assert.ok(!JSON.stringify(result).includes("correct horse"));
  const missing = await register(gateway, { ...input, confirmPassword: undefined });
  assert.equal(missing.fields.confirmPassword, "Las contraseñas no coinciden.");
});
