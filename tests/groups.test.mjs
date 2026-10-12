import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { invitationText, whatsappShareUrl } = require("../build/tests/features/groups/domain/groups.js");
const { createGroupsGateway } = require("../build/tests/features/groups/infrastructure/http-groups-gateway.js");
const { createGroup, joinGroup, getGroup, leaveGroup, normalizeJoinCode, FieldValidationError } = require("../build/tests/features/groups/application/groups.js");
const { ServiceError } = require("../build/tests/lib/http/errors.js");

const BASE = "https://api.example.com";
const TOKEN = "opaque.token";
const member = { user_id: 1, display_name: "Alice", email: "alice@example.com", avatar_url: null, role: "admin", joined_at: "2026-10-04T12:00:00.123456+00:00" };
const group = {
  id: 7, name: "Peña del barrio", description: null, join_code: "A3F9KX", max_members: 50, show_picks: false,
  created_by_user_id: 1, created_at: "2026-10-04T12:00:00Z", member_count: 1, role: "admin",
};
const detail = { ...group, members: [member] };
const response = (payload, status = 200) => new Response(JSON.stringify(payload), { status });
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof ServiceError && error.code === code && !error.message.includes("private-detail"));
const gatewayWith = (fetcher, timeout) => createGroupsGateway(BASE, TOKEN, fetcher, timeout);
const capture = (payload, status = 200) => { const calls = []; return { calls, fetcher: async (url, init) => { calls.push({ url, init }); return response(payload, status); } }; };

test("list maps snake_case to camelCase and numeric ids to strings", async () => {
  const { fetcher, calls } = capture([group]);
  const [result] = await gatewayWith(fetcher).list();
  assert.equal(result.id, "7");
  assert.equal(result.createdByUserId, "1");
  assert.equal(result.joinCode, "A3F9KX");
  assert.equal(result.memberCount, 1);
  assert.equal(result.maxMembers, 50);
  assert.equal(result.description, null);
  assert.equal(result.role, "admin");
  assert.equal(result.join_code, undefined);
  assert.equal(calls[0].url, `${BASE}/groups`);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0].init.cache, "no-store");
});

test("detail maps members and does not leak member emails", async () => {
  const { fetcher, calls } = capture(detail);
  const result = await gatewayWith(fetcher).get("7");
  assert.equal(calls[0].url, `${BASE}/groups/7`);
  assert.deepEqual(result.members, [{ userId: "1", displayName: "Alice", avatarUrl: null, role: "admin", joinedAt: member.joined_at }]);
  assert.equal(result.showPicks, false);
});

test("create posts name/description and omits an empty description", async () => {
  const withDescription = capture(detail, 201);
  await gatewayWith(withDescription.fetcher).create({ name: "Peña", description: "Café" });
  assert.equal(withDescription.calls[0].url, `${BASE}/groups`);
  assert.equal(withDescription.calls[0].init.method, "POST");
  assert.equal(withDescription.calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(withDescription.calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(withDescription.calls[0].init.body), { name: "Peña", description: "Café" });
  const bare = capture(detail, 201);
  await gatewayWith(bare.fetcher).create({ name: "Peña" });
  assert.deepEqual(JSON.parse(bare.calls[0].init.body), { name: "Peña" });
});

test("join posts the join_code and maps the detail response", async () => {
  const { fetcher, calls } = capture({ ...detail, role: "member" });
  const result = await gatewayWith(fetcher).join("A3F9KX");
  assert.equal(calls[0].url, `${BASE}/groups/join`);
  assert.deepEqual(JSON.parse(calls[0].init.body), { join_code: "A3F9KX" });
  assert.equal(result.role, "member");
});

test("leave posts to the leave endpoint and accepts 204 with no body", async () => {
  const calls = [];
  const gateway = gatewayWith(async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 204 }); });
  assert.equal(await gateway.leave("7"), undefined);
  assert.equal(calls[0].url, `${BASE}/groups/7/leave`);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
});

test("leave maps the creator rejection (400) to creator-cannot-leave", async () => {
  await rejectsCode(gatewayWith(async () => response({ detail: "private-detail" }, 400)).leave("7"), "creator-cannot-leave");
  assert.match(new ServiceError("creator-cannot-leave").message, /creador/i);
});

for (const [name, payload] of [
  ["a non-array list", { id: 1 }],
  ["a group without a join code", [{ ...group, join_code: undefined }]],
  ["a string id", [{ ...group, id: "7" }]],
  ["an unknown role", [{ ...group, role: "owner" }]],
  ["an invalid timestamp", [{ ...group, created_at: "yesterday" }]],
]) {
  test(`list rejects malformed payload: ${name}`, async () => {
    await rejectsCode(gatewayWith(async () => response(payload)).list(), "malformed");
  });
}

test("detail rejects a payload without members and non-JSON bodies", async () => {
  await rejectsCode(gatewayWith(async () => response(group)).get("7"), "malformed");
  await rejectsCode(gatewayWith(async () => new Response("<html>", { status: 200 })).get("7"), "malformed");
});

for (const [status, code] of [[401, "unauthenticated"], [403, "forbidden"], [404, "not-found"], [409, "conflict"], [400, "validation"], [422, "validation"], [429, "rate-limit"], [500, "upstream"], [503, "upstream"]]) {
  test(`authenticated calls normalize HTTP ${status} to ${code} without backend detail`, async () => {
    await rejectsCode(gatewayWith(async () => response({ detail: "private-detail" }, status)).list(), code);
  });
}

test("join tells apart an unknown code, an existing membership and a full group", async () => {
  await rejectsCode(gatewayWith(async () => response({ detail: "join_code not found" }, 404)).join("ZZZZZZ"), "invalid-join-code");
  await rejectsCode(gatewayWith(async () => response({ detail: { code: "already_member", message: "x" } }, 409)).join("A3F9KX"), "already-member");
  await rejectsCode(gatewayWith(async () => response({ detail: { code: "group_full", message: "x" } }, 400)).join("A3F9KX"), "group-full");
  await rejectsCode(gatewayWith(async () => response({ detail: "invalid" }, 422)).join("A3F9KX"), "validation");
});

test("network failures and timeouts are distinct from backend outages", async () => {
  await rejectsCode(gatewayWith(async () => { throw new TypeError("fetch failed"); }).list(), "network");
  const slow = gatewayWith((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))), 10);
  await rejectsCode(slow.list(), "timeout");
});

test("join codes are trimmed and uppercased before reaching the gateway", async () => {
  assert.equal(normalizeJoinCode("  a3f9kx \n"), "A3F9KX");
  assert.equal(normalizeJoinCode(undefined), "");
  let sent;
  const stub = { join: async (code) => { sent = code; return { id: "7" }; } };
  await joinGroup(stub, { joinCode: " a3f9kx " });
  assert.equal(sent, "A3F9KX");
});

test("invalid join codes and group names never reach the gateway", async () => {
  let called = false;
  const stub = { join: async () => { called = true; }, create: async () => { called = true; }, get: async () => { called = true; }, leave: async () => { called = true; } };
  await assert.rejects(joinGroup(stub, { joinCode: "ABC" }), error => error instanceof FieldValidationError && "joinCode" in error.fields);
  await assert.rejects(joinGroup(stub, { joinCode: "ABCDEFGHI" }), FieldValidationError);
  await assert.rejects(createGroup(stub, { name: " a ", description: "" }), error => error instanceof FieldValidationError && "name" in error.fields);
  await assert.rejects(createGroup(stub, { name: "x".repeat(81), description: "" }), FieldValidationError);
  await assert.rejects(createGroup(stub, { name: "Valid", description: "d".repeat(2001) }), error => error instanceof FieldValidationError && "description" in error.fields);
  await rejectsCode(getGroup(stub, "abc"), "not-found");
  await rejectsCode(leaveGroup(stub, "0"), "not-found");
  assert.equal(called, false);
});

test("create trims input and drops a blank description", async () => {
  let sent;
  const stub = { create: async (input) => { sent = input; return { id: "7" }; } };
  await createGroup(stub, { name: "  Peña  ", description: "   " });
  assert.deepEqual(sent, { name: "Peña" });
  await createGroup(stub, { name: "Peña", description: " Café " });
  assert.deepEqual(sent, { name: "Peña", description: "Café" });
});

test("whatsappShareUrl encodes the Spanish invitation with group name and code", () => {
  const text = invitationText("Peña & amigos", "A3F9KX");
  assert.equal(text, "Únete a mi peña «Peña & amigos» en La Goyniela con el código A3F9KX.");
  const url = whatsappShareUrl("Peña & amigos", "A3F9KX");
  assert.ok(url.startsWith("https://wa.me/?text="));
  assert.equal(new URL(url).searchParams.get("text"), text);
  assert.ok(!url.slice("https://wa.me/?text=".length).includes("&"));
});
