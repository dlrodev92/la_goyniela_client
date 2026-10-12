import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createGroupsGateway } = require("../build/tests/features/groups/infrastructure/http-groups-gateway.js");
const { changeMember, deleteGroup, setShowPicks, FieldValidationError } = require("../build/tests/features/groups/application/groups.js");
const { memberActions, canManageGroup, canDeleteGroup, matchesGroupName, isMemberAction } = require("../build/tests/features/groups/domain/groups.js");
const { ServiceError } = require("../build/tests/lib/http/errors.js");

const BASE = "https://api.example.com";
const TOKEN = "opaque.token";
const group = {
  id: 7, name: "Peña del barrio", description: null, join_code: "A3F9KX", max_members: 50, show_picks: true,
  created_by_user_id: 1, created_at: "2026-10-04T12:00:00Z", member_count: 3, role: "admin",
};
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof ServiceError && error.code === code && !error.message.includes("private-detail"));
const recorder = (make) => { const calls = []; return { calls, fetcher: async (url, init) => { calls.push({ url, init }); return make(); } }; };
const noContent = () => new Response(null, { status: 204 });
const gatewayWith = (fetcher) => createGroupsGateway(BASE, TOKEN, fetcher);

test("setShowPicks PATCHes show_picks and maps the group", async () => {
  const { fetcher, calls } = recorder(() => new Response(JSON.stringify(group), { status: 200 }));
  const result = await gatewayWith(fetcher).setShowPicks("7", true);
  assert.equal(calls[0].url, `${BASE}/groups/7`);
  assert.equal(calls[0].init.method, "PATCH");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), { show_picks: true });
  assert.equal(result.showPicks, true);
  assert.equal(result.id, "7");
});

test("promote, demote, remove and delete use the right method and URL and accept 204", async () => {
  const cases = [
    ["promoteMember", ["7", "3"], "POST", "/groups/7/members/3/promote"],
    ["demoteMember", ["7", "3"], "POST", "/groups/7/members/3/demote"],
    ["removeMember", ["7", "3"], "DELETE", "/groups/7/members/3"],
    ["delete", ["7"], "DELETE", "/groups/7"],
  ];
  for (const [method, args, verb, path] of cases) {
    const { fetcher, calls } = recorder(noContent);
    assert.equal(await gatewayWith(fetcher)[method](...args), undefined);
    assert.equal(calls[0].url, `${BASE}${path}`);
    assert.equal(calls[0].init.method, verb);
    assert.equal(calls[0].init.body, undefined);
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  }
});

test("delete and settings keep the generic safe codes", async () => {
  for (const [status, code] of [[403, "forbidden"], [404, "not-found"], [409, "conflict"], [401, "unauthenticated"], [400, "validation"]]) {
    const fetcher = async () => new Response(JSON.stringify({ detail: "private-detail" }), { status });
    await rejectsCode(gatewayWith(fetcher).delete("7"), code);
    await rejectsCode(gatewayWith(fetcher).setShowPicks("7", false), code);
  }
});

test("promote, demote and remove map backend status codes to specific errors", async () => {
  const cases = [
    ["promoteMember", [[400, "self-action"], [403, "creator-protected"], [409, "already-admin"], [404, "not-found"], [401, "unauthenticated"]]],
    ["demoteMember", [[400, "self-action"], [403, "creator-protected"], [409, "not-admin"], [404, "not-found"]]],
    ["removeMember", [[400, "self-action"], [403, "creator-protected"], [404, "not-found"], [409, "conflict"]]],
  ];
  for (const [method, table] of cases) {
    for (const [status, code] of table) {
      const fetcher = async () => new Response(JSON.stringify({ detail: "private-detail" }), { status });
      await rejectsCode(gatewayWith(fetcher)[method]("7", "3"), code);
    }
  }
  const fetcher = async () => new Response(JSON.stringify({ detail: "x" }), { status: 400 });
  await assert.rejects(gatewayWith(fetcher).leave("7"), error => error.code === "creator-cannot-leave");
});

test("specific admin errors have distinct Spanish messages", () => {
  const messages = ["self-action", "creator-protected", "already-admin", "not-admin"].map(code => new ServiceError(code).message);
  assert.equal(new Set(messages).size, 4);
  for (const message of messages) assert.ok(!message.includes("—"));
});

test("invalid ids never reach the gateway", async () => {
  let called = false;
  const stub = new Proxy({}, { get: () => async () => { called = true; } });
  await rejectsCode(setShowPicks(stub, "abc", true), "not-found");
  await rejectsCode(changeMember(stub, { groupId: "7", userId: "x", action: "remove" }), "not-found");
  await rejectsCode(deleteGroup(stub, { groupId: "0", confirmName: "x" }), "not-found");
  assert.equal(called, false);
});

test("changeMember dispatches to the matching gateway call", async () => {
  const seen = [];
  const stub = { promoteMember: async (...a) => seen.push(["promote", ...a]), demoteMember: async (...a) => seen.push(["demote", ...a]), removeMember: async (...a) => seen.push(["remove", ...a]) };
  for (const action of ["promote", "demote", "remove"]) await changeMember(stub, { groupId: "7", userId: "3", action });
  assert.deepEqual(seen, [["promote", "7", "3"], ["demote", "7", "3"], ["remove", "7", "3"]]);
});

test("deleteGroup requires the exact group name and checks it against the stored name", async () => {
  let deleted = 0;
  const stub = { get: async () => ({ name: "Peña del barrio" }), delete: async () => { deleted += 1; } };
  await assert.rejects(deleteGroup(stub, { groupId: "7", confirmName: "peña del barrio" }), error => error instanceof FieldValidationError && "confirmName" in error.fields);
  await assert.rejects(deleteGroup(stub, { groupId: "7", confirmName: undefined }), FieldValidationError);
  assert.equal(deleted, 0);
  await deleteGroup(stub, { groupId: "7", confirmName: "  Peña del barrio " });
  assert.equal(deleted, 1);
});

test("memberActions: who can do what to whom", () => {
  const creatorGroup = { createdByUserId: "1", role: "admin" };
  const adminGroup = { createdByUserId: "1", role: "admin" };
  const memberGroup = { createdByUserId: "1", role: "member" };
  const creator = { userId: "1", role: "admin" };
  const otherAdmin = { userId: "2", role: "admin" };
  const plain = { userId: "3", role: "member" };
  // Creator (actor 1)
  assert.deepEqual(memberActions(creatorGroup, "1", plain), ["promote", "remove"]);
  assert.deepEqual(memberActions(creatorGroup, "1", otherAdmin), ["demote", "remove"]);
  assert.deepEqual(memberActions(creatorGroup, "1", creator), []);
  // Non-creator admin (actor 2)
  assert.deepEqual(memberActions(adminGroup, "2", plain), ["promote", "remove"]);
  assert.deepEqual(memberActions(adminGroup, "2", creator), []);
  assert.deepEqual(memberActions(adminGroup, "2", otherAdmin), []);
  // Plain member (actor 3) gets nothing
  for (const target of [creator, otherAdmin, plain]) assert.deepEqual(memberActions(memberGroup, "3", target), []);
});

test("capability helpers and confirmation matching", () => {
  assert.equal(canManageGroup({ role: "admin" }), true);
  assert.equal(canManageGroup({ role: "member" }), false);
  assert.equal(canDeleteGroup({ createdByUserId: "1" }, "1"), true);
  assert.equal(canDeleteGroup({ createdByUserId: "1" }, "2"), false);
  assert.equal(matchesGroupName(" Peña ", "Peña"), true);
  assert.equal(matchesGroupName("peña", "Peña"), false);
  assert.equal(matchesGroupName("", ""), true);
  assert.equal(matchesGroupName(null, "Peña"), false);
  assert.equal(isMemberAction("remove"), true);
  assert.equal(isMemberAction("ban"), false);
});
