import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { decideSuperadmin, needsProbe } = require("../build/tests/features/superadmin/domain/access.js");
const { parseAdminStatus, STATUS_LABELS } = require("../build/tests/features/superadmin/domain/jornadas.js");
const { planStatusChange, needsSaleOpensAt, chainNote, partialFailureMessage } = require("../build/tests/features/superadmin/domain/status-change.js");
const { parseTab } = require("../build/tests/features/superadmin/domain/tabs.js");
const { madridLocalToIso, isoToMadridLocal, madridOffsetMinutes, formatShortMadrid, formatDayMadrid } = require("../build/tests/features/superadmin/domain/datetime.js");
const { adminStatusMap, adminErrorCopy } = require("../build/tests/features/superadmin/domain/errors.js");
const { summarizeIngest, parseIngestForm } = require("../build/tests/features/superadmin/domain/ingest.js");
const { filterTeams, paginate, pageOf } = require("../build/tests/features/superadmin/domain/admin.js");
const { checkLogoFile } = require("../build/tests/features/superadmin/domain/logo.js");
const { parseTeamForm, parseJornadaForm, parseOpenForm, parseComposicionForm } = require("../build/tests/features/superadmin/application/forms.js");
const schemas = require("../build/tests/features/superadmin/infrastructure/admin-schemas.js");
const { createAdminGateway } = require("../build/tests/features/superadmin/infrastructure/http-admin-gateway.js");
const { ServiceError } = require("../build/tests/lib/http/errors.js");

const BASE = "https://api.example.com";
const response = (payload, status = 200, headers = {}) => new Response(payload === undefined ? null : JSON.stringify(payload), { status, headers });
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof ServiceError && error.code === code);
const capture = (payload, status = 200, headers) => { const calls = []; return { calls, fetcher: async (url, init) => { calls.push({ url, init }); return response(payload, status, headers); } }; };

// Realistic payloads shaped after the live OpenAPI (UserAdminOut, TeamOut, JornadaAdminOut, ComposicionAdminOut).
const userWire = { id: 1, email: "dlro92@gmail.com", display_name: "David", is_active: true, is_superadmin: true, created_at: "2026-09-01T10:00:00Z" };
const teamWire = {
  id: 1, entity_id: "club-men-ac-milan", canonical_name: "AC Milan", short_name: "Milan", gender: "men", gender_known: true, country: "ITA",
  logo_url: "https://cdn.example.com/teams/club-men-ac-milan.png", competition_id: "uefa-europa-league", deleted_at: null,
};
const jornadaWire = {
  id: 11, temporada: 2026, temporada_str: "26/27", numero: 7, status: "draft", sale_opens_at: null, voting_closes_at: null,
  kickoff_first_match_at: "2026-10-10T14:00:00Z", kickoff_last_match_at: "2026-10-12T19:00:00Z", escrutinio_expected_at: "2026-10-13T08:00:00Z",
  fetched_at: "2026-10-08T07:00:00Z", deleted_at: null,
};
const composicionWire = { posicion: 3, local_team_id: 4, visitante_team_id: 9, local_raw: "Alavés", visitante_raw: "Betis", kickoff_at: null, competicion_raw: "LaLiga" };

// 1. Access gate
test("superadmin gate: the flag grants, otherwise only a successful probe does", () => {
  assert.equal(decideSuperadmin({ isSuperadmin: true, probe: null }), true);
  assert.equal(decideSuperadmin({ isSuperadmin: true, probe: "denied" }), true);
  assert.equal(decideSuperadmin({ isSuperadmin: false, probe: "granted" }), true);
  assert.equal(decideSuperadmin({ isSuperadmin: false, probe: "denied" }), false);
  assert.equal(decideSuperadmin({ isSuperadmin: false, probe: "unavailable" }), false);
  assert.equal(decideSuperadmin({ isSuperadmin: false, probe: null }), false);
  assert.equal(needsProbe(true), false);
  assert.equal(needsProbe(false), true);
});

// 2. Jornada status changes
test("every status can be reached from every status (9 pairs)", () => {
  const actions = (from, to, hasSale = true) => planStatusChange(from, to, hasSale).map(step => step.action);
  // Same state: nothing to do.
  for (const status of ["draft", "active", "past"]) assert.deepEqual(planStatusChange(status, status, true), []);
  // The four direct edges the backend allows.
  assert.deepEqual(actions("draft", "active"), ["open"]);
  assert.deepEqual(actions("active", "past"), ["close"]);
  assert.deepEqual(actions("past", "active"), ["reopen"]);
  assert.deepEqual(actions("active", "draft"), ["patch-draft"]);
  // The two chains go through active.
  assert.deepEqual(actions("draft", "past"), ["open", "close"]);
  assert.deepEqual(actions("past", "draft"), ["reopen", "patch-draft"]);
});

test("a plan only ever uses edges the backend allows and ends where asked", () => {
  const allowed = { draft: ["active"], active: ["draft", "past"], past: ["active"] };
  for (const from of ["draft", "active", "past"]) for (const to of ["draft", "active", "past"]) {
    let at = from;
    for (const step of planStatusChange(from, to, true)) {
      assert.ok(allowed[at].includes(step.reaches), `${from}->${to}: ${at}->${step.reaches}`);
      at = step.reaches;
    }
    assert.equal(at, to);
  }
});

test("open asks for sale_opens_at only when there is none stored", () => {
  assert.equal(needsSaleOpensAt(planStatusChange("draft", "active", false)), true);
  assert.equal(needsSaleOpensAt(planStatusChange("draft", "past", false)), true);
  assert.equal(needsSaleOpensAt(planStatusChange("draft", "active", true)), false);
  assert.equal(needsSaleOpensAt(planStatusChange("active", "past", false)), false);
  assert.equal(needsSaleOpensAt(planStatusChange("past", "draft", false)), false);
  assert.deepEqual(planStatusChange("draft", "past", false)[0], { action: "open", reaches: "active", usesNow: true });
  assert.deepEqual(planStatusChange("draft", "past", true)[0], { action: "open", reaches: "active", usesNow: false });
});

test("chains are announced and partial failures say where the jornada was left", () => {
  assert.equal(chainNote(planStatusChange("draft", "active", true)), null);
  assert.match(chainNote(planStatusChange("draft", "past", true)), /Activa/);
  assert.match(chainNote(planStatusChange("past", "draft", true)), /Activa/);
  const message = partialFailureMessage("active", "past", "Inténtalo de nuevo.");
  assert.match(message, /«Activa»/);
  assert.match(message, /«Pasada»/);
  assert.equal(STATUS_LABELS.draft, "Borrador");
  assert.equal(parseAdminStatus("past"), "past");
  assert.equal(parseAdminStatus("closed"), null);
});

test("the tab comes from ?tab= and defaults to jornadas", () => {
  assert.equal(parseTab("equipos"), "equipos");
  assert.equal(parseTab("usuarios"), "usuarios");
  assert.equal(parseTab("jornadas"), "jornadas");
  for (const value of [undefined, "", "otros", ["equipos"], null]) assert.equal(parseTab(value), "jornadas");
});

test("compact Madrid formatters", () => {
  assert.equal(formatShortMadrid(null), "—");
  assert.equal(formatShortMadrid("nope"), "—");
  assert.match(formatShortMadrid("2026-10-10T14:00:00Z"), /^10 oct\.?,? 16:00$/);
  assert.equal(formatDayMadrid(undefined), "—");
  assert.match(formatDayMadrid("2026-10-08T07:00:00Z"), /8 oct\.? 2026/);
});

// 3. Europe/Madrid conversion
test("datetime-local converts to ISO with the Madrid offset", () => {
  assert.equal(madridLocalToIso("2026-01-15T12:00"), "2026-01-15T12:00:00+01:00");
  assert.equal(madridLocalToIso("2026-07-15T12:00"), "2026-07-15T12:00:00+02:00");
  assert.equal(madridLocalToIso(""), null);
  assert.equal(madridLocalToIso("2026-02-31T10:00"), null);
  assert.equal(madridLocalToIso("not a date"), null);
});

test("DST boundaries: spring gap, autumn overlap and the instants around them", () => {
  // Spring forward 2026-03-29: 02:00 -> 03:00 CET -> CEST.
  assert.equal(madridLocalToIso("2026-03-29T01:59"), "2026-03-29T01:59:00+01:00");
  assert.equal(madridLocalToIso("2026-03-29T02:30"), null, "a time inside the gap does not exist");
  assert.equal(madridLocalToIso("2026-03-29T03:00"), "2026-03-29T03:00:00+02:00");
  // Fall back 2026-10-25: 03:00 CEST -> 02:00 CET, so 02:30 happens twice; the first (summer) one wins.
  assert.equal(madridLocalToIso("2026-10-25T01:59"), "2026-10-25T01:59:00+02:00");
  assert.equal(madridLocalToIso("2026-10-25T02:30"), "2026-10-25T02:30:00+02:00");
  assert.equal(madridLocalToIso("2026-10-25T03:00"), "2026-10-25T03:00:00+01:00");
  assert.equal(madridOffsetMinutes(Date.parse("2026-10-25T00:30:00Z")), 120);
  assert.equal(madridOffsetMinutes(Date.parse("2026-10-25T01:30:00Z")), 60);
});

test("ISO instants render back as Madrid wall-clock time and round-trip", () => {
  assert.equal(isoToMadridLocal("2026-10-10T14:00:00Z"), "2026-10-10T16:00");
  assert.equal(isoToMadridLocal("2026-01-15T11:00:00Z"), "2026-01-15T12:00");
  assert.equal(isoToMadridLocal("2026-10-25T01:30:00Z"), "2026-10-25T02:30"); // second 02:30 (CET)
  assert.equal(isoToMadridLocal(null), "");
  assert.equal(isoToMadridLocal("garbage"), "");
  for (const local of ["2026-03-29T03:00", "2026-07-01T23:59", "2026-12-31T00:00", "2026-10-25T03:30"]) {
    assert.equal(isoToMadridLocal(madridLocalToIso(local)), local);
  }
});

// 4. Error mapping
test("every admin failure maps to clear Spanish copy", () => {
  assert.equal(adminErrorCopy("last-superadmin"), "No se puede quitar al último superadmin: promociona antes a otra persona.");
  assert.equal(adminErrorCopy("team-in-use"), "No se puede eliminar: el equipo está en uso.");
  assert.match(adminErrorCopy("admin-invalid"), /no son válidos/);
  assert.match(adminErrorCopy("forbidden"), /permiso/);
  assert.match(adminErrorCopy("not-found"), /encontrado/);
  assert.match(adminErrorCopy("team-duplicate"), /Ya existe/);
  assert.match(adminErrorCopy("invalid-transition"), /estado actual/);
  assert.match(adminErrorCopy("invalid-team-ref"), /equipos/);
  assert.equal(adminErrorCopy("rate-limit", 42), "Demasiadas solicitudes, reinténtalo en 42s");
});

test("status maps pick the right code per operation", () => {
  assert.equal(adminStatusMap("user-patch")[400], "last-superadmin");
  assert.equal(adminStatusMap("team-delete")[409], "team-in-use");
  assert.equal(adminStatusMap("team-create")[409], "team-duplicate");
  assert.equal(adminStatusMap("jornada-transition")[400], "invalid-transition");
  assert.equal(adminStatusMap("composicion-patch")[400], "invalid-team-ref");
  assert.equal(adminStatusMap("logo")[413], "file-too-large");
  assert.equal(adminStatusMap("read")[400], undefined);
  // 401/403/404/429 are never overridden: they keep the shared mapping.
  for (const op of ["user-patch", "team-create", "team-patch", "team-delete", "jornada-patch", "composicion-patch", "ingest", "logo"]) {
    for (const status of [401, 403, 404, 429]) assert.equal(adminStatusMap(op)[status], undefined);
  }
});

test("gateway maps 400/403/404/409/422/429 end to end", async () => {
  const run = (status, call, headers) => call(createAdminGateway(BASE, "t", async () => response({ detail: "x" }, status, headers)));
  await rejectsCode(run(400, g => g.patchUser("2", { isSuperadmin: false })), "last-superadmin");
  await rejectsCode(run(403, g => g.listUsers({ onlySuperadmins: false, limit: 1, offset: 0 })), "forbidden");
  await rejectsCode(run(401, g => g.listUsers({ onlySuperadmins: false, limit: 1, offset: 0 })), "unauthenticated");
  await rejectsCode(run(404, g => g.getJornada("99")), "not-found");
  await rejectsCode(run(409, g => g.deleteTeam("3")), "team-in-use");
  await rejectsCode(run(409, g => g.createTeam({ entityId: "a", name: "A", shortName: null, gender: null, genderKnown: true, country: null, logoUrl: null, competitionId: "c" })), "team-duplicate");
  await rejectsCode(run(422, g => g.patchTeam("3", { name: "x" })), "admin-invalid");
  await rejectsCode(run(400, g => g.patchComposicion("1", 2, { homeTeamId: "9" })), "invalid-team-ref");
  await rejectsCode(run(400, g => g.transitionJornada("1", "close")), "invalid-transition");
  await assert.rejects(run(429, g => g.listTeams({ includeDeleted: false, limit: 5, offset: 0 }), { "Retry-After": "60" }), error =>
    error instanceof ServiceError && error.code === "rate-limit" && error.retryAfterSeconds === 60 && error.message === "Demasiadas solicitudes, reinténtalo en 60s");
  await rejectsCode(run(500, g => g.getJornada("1")), "upstream");
});

test("a rate-limited call is made exactly once (never auto-retried)", async () => {
  const { calls, fetcher } = capture({ detail: "slow down" }, 429, { "Retry-After": "30" });
  await assert.rejects(createAdminGateway(BASE, "t", fetcher).listJornadas({ includeDeleted: false, status: null, limit: 26, offset: 0 }));
  assert.equal(calls.length, 1);
});

// 5. Ingest
const ingestWire = {
  quiniwin: {
    status: "partial", temporada: 2026, max_known_jornada: 6,
    jornadas: [
      { status: "ok", jornada: 7, jornadas_inserted: 1, jornadas_existing: 0, composicion_inserted: 15, composicion_existing: 0, stubs_created: 2 },
      { status: "error", jornada: 8, jornadas_inserted: 0, jornadas_existing: 0, composicion_inserted: 0, composicion_existing: 0, stubs_created: 0 },
    ],
    ok_count: 1, fail_count: 1,
  },
  losilla_per_jornada: {
    "7": { status: "ok", escrutinio_inserted: false, escrutinio_existed: false, comentarios_inserted: 15, comentarios_updated: 0, comentarios_existing: 0, network_failures: [] },
    "6": { status: "error", escrutinio_inserted: false, escrutinio_existed: true, comentarios_inserted: 0, comentarios_updated: 0, comentarios_existing: 15, network_failures: ["timeout"], error: "boom" },
  },
};

test("ingest response is normalized and summarized", () => {
  const report = schemas.toIngestReport(schemas.ingestSchema.parse(ingestWire));
  assert.deepEqual(report.jornadas.map(row => row.jornada), [7, 8]);
  assert.deepEqual(report.losilla.map(row => row.jornada), [6, 7]);
  assert.equal(report.losilla[0].error, "boom");
  assert.deepEqual(report.losilla[0].networkFailures, ["timeout"]);
  assert.equal(report.maxKnownJornada, 6);
  const summary = summarizeIngest(report);
  assert.equal(summary.tone, "warning");
  assert.match(summary.lines.join("\n"), /1 jornada correcta y 1 fallo/);
  assert.match(summary.lines.join("\n"), /1 creada/);
  assert.match(summary.lines.join("\n"), /Fallos de red al consultar Losilla: 1/);
});

test("ingest summaries cover success, noop and failure", () => {
  const base = { quiniwinStatus: "ok", season: 2026, maxKnownJornada: 6, jornadas: [], okCount: 0, failCount: 0, losilla: [] };
  assert.equal(summarizeIngest({ ...base, quiniwinStatus: "noop" }).tone, "info");
  const ok = { inserted: 1, existing: 0, composicionInserted: 15, composicionExisting: 0, stubsCreated: 0 };
  assert.equal(summarizeIngest({ ...base, jornadas: [{ jornada: 7, status: "ok", ...ok }], okCount: 1 }).tone, "success");
  assert.equal(summarizeIngest({ ...base, jornadas: [{ jornada: 7, status: "error", ...ok }], failCount: 1 }).tone, "error");
  const quiet = schemas.toIngestReport(schemas.ingestSchema.parse({ quiniwin: { status: "noop", temporada: 2026, max_known_jornada: null, jornadas: [], ok_count: 0, fail_count: 0 }, losilla_per_jornada: {} }));
  assert.equal(quiet.maxKnownJornada, null);
  assert.equal(summarizeIngest(quiet).headline, "No había nada nuevo que importar.");
});

test("ingest form omits empty fields and validates ranges", () => {
  assert.deepEqual(parseIngestForm({}, true), { ok: true, request: { runLosilla: true } });
  assert.deepEqual(parseIngestForm({ temporada: "2026", jornadaRangeStart: "3", jornadaRangeEnd: "9", forwardCap: "2", fetchTimeoutSec: "30,5" }, false), {
    ok: true, request: { runLosilla: false, temporada: 2026, jornadaRangeStart: 3, jornadaRangeEnd: 9, forwardCap: 2, fetchTimeoutSec: 30.5 },
  });
  const bad = parseIngestForm({ temporada: "1900", jornadaRangeStart: "10", jornadaRangeEnd: "5", forwardCap: "0", fetchTimeoutSec: "500" }, true);
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.fields).sort(), ["fetchTimeoutSec", "forwardCap", "jornadaRangeEnd", "temporada"]);
});

test("ingest request sends only the provided fields as snake_case", async () => {
  const { calls, fetcher } = capture(ingestWire);
  const report = await createAdminGateway(BASE, "t", fetcher).ingestQuiniwin({ runLosilla: false, jornadaRangeEnd: 9 });
  assert.equal(calls[0].url, `${BASE}/api/v1/admin/ingest/quiniwin`);
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), { jornada_range_end: 9, run_losilla: false });
  assert.equal(report.okCount, 1);
});

// 6. Zod parsing of the admin responses
test("admin response schemas parse realistic fixtures", () => {
  assert.equal(schemas.toUser(schemas.userSchema.parse(userWire)).isSuperadmin, true);
  assert.equal(schemas.userListSchema.parse([userWire, { ...userWire, id: 2, is_superadmin: false }]).length, 2);
  const team = schemas.toTeam(schemas.teamSchema.parse(teamWire));
  assert.deepEqual([team.id, team.name, team.shortName, team.competitionId, team.deletedAt], ["1", "AC Milan", "Milan", "uefa-europa-league", null]);
  const jornada = schemas.toJornada(schemas.jornadaSchema.parse(jornadaWire));
  assert.deepEqual([jornada.id, jornada.number, jornada.status, jornada.saleOpensAt, jornada.deletedAt], ["11", 7, "draft", null, null]);
  assert.equal(jornada.kickoffLastAt, "2026-10-12T19:00:00Z");
  const row = schemas.toComposicion(schemas.composicionSchema.parse(composicionWire));
  assert.deepEqual([row.position, row.homeTeamId, row.awayRaw, row.kickoffAt, row.competition], [3, "4", "Betis", null, "LaLiga"]);
  assert.equal(schemas.logoSchema.parse({ team_id: 1, entity_id: "club-men-ac-milan", logo_url: "https://cdn.example.com/t.png", size: 1234 }).size, 1234);
  const options = schemas.publicTeamListSchema.parse({ items: [{ id: 1, entity_id: "e", competition_id: "c", canonical_name: "AC Milan", short_name: "Milan", gender: "men", country: "ITA", logo_url: null }], total: 427, limit: 8, offset: 0 });
  assert.equal(schemas.toTeamOption(options.items[0]).name, "AC Milan");
});

test("schemas reject malformed payloads", () => {
  assert.equal(schemas.jornadaSchema.safeParse({ ...jornadaWire, status: "closed" }).success, false);
  assert.equal(schemas.jornadaSchema.safeParse({ ...jornadaWire, fetched_at: "yesterday" }).success, false);
  assert.equal(schemas.teamSchema.safeParse({ ...teamWire, id: 0 }).success, false);
  assert.equal(schemas.composicionSchema.safeParse({ ...composicionWire, posicion: 16 }).success, false);
  assert.equal(schemas.userSchema.safeParse({ ...userWire, is_superadmin: "yes" }).success, false);
});

test("gateway builds the documented URLs, methods and bodies", async () => {
  const get = async (payload, call) => { const { calls, fetcher } = capture(payload); const result = await call(createAdminGateway(BASE, "tok", fetcher)); return { calls, result }; };
  let out = await get([userWire], g => g.listUsers({ onlySuperadmins: true, limit: 26, offset: 25 }));
  assert.equal(out.calls[0].url, `${BASE}/api/v1/admin/users?only_superadmins=true&limit=26&offset=25`);
  assert.equal(out.calls[0].init.headers.Authorization, "Bearer tok");
  out = await get([teamWire], g => g.listTeams({ includeDeleted: true, limit: 26, offset: 0 }));
  assert.equal(out.calls[0].url, `${BASE}/api/v1/admin/teams?include_deleted=true&limit=26&offset=0`);
  out = await get([jornadaWire], g => g.listJornadas({ includeDeleted: false, status: "active", limit: 26, offset: 0 }));
  assert.equal(out.calls[0].url, `${BASE}/api/v1/admin/jornadas?status=active&limit=26&offset=0`);
  out = await get(jornadaWire, g => g.transitionJornada("11", "open", { saleOpensAt: "2026-10-10T10:00:00+02:00" }));
  assert.equal(out.calls[0].url, `${BASE}/api/v1/admin/jornadas/11/open`);
  assert.deepEqual(JSON.parse(out.calls[0].init.body), { sale_opens_at: "2026-10-10T10:00:00+02:00" });
  out = await get(jornadaWire, g => g.transitionJornada("11", "close"));
  assert.equal(out.calls[0].init.body, undefined);
  out = await get(jornadaWire, g => g.patchJornada("11", { status: "active", saleOpensAt: null }));
  assert.deepEqual(JSON.parse(out.calls[0].init.body), { status: "active", sale_opens_at: null });
  out = await get(composicionWire, g => g.patchComposicion("11", 3, { homeTeamId: "5", kickoffAt: "2026-10-10T16:00:00+02:00", competition: null }));
  assert.equal(out.calls[0].url, `${BASE}/api/v1/admin/jornadas/11/composicion/3`);
  assert.deepEqual(JSON.parse(out.calls[0].init.body), { local_team_id: 5, kickoff_at: "2026-10-10T16:00:00+02:00", competicion_raw: null });
  out = await get(userWire, g => g.patchUser("1", { isActive: false }));
  assert.deepEqual(JSON.parse(out.calls[0].init.body), { is_active: false });
  out = await get(teamWire, g => g.patchTeam("1", { name: "Milan FC", shortName: null }));
  assert.deepEqual(JSON.parse(out.calls[0].init.body), { canonical_name: "Milan FC", short_name: null });
  out = await get({ items: [], total: 0, limit: 8, offset: 0 }, g => g.searchTeams("  mil ", 8));
  assert.equal(out.calls[0].url, `${BASE}/api/v1/teams?q=mil&limit=8`);
});

test("logo upload is multipart on the legacy route without a manual Content-Type", async () => {
  const { calls, fetcher } = capture({ team_id: 1, entity_id: "e", logo_url: "https://cdn.example.com/t.png", size: 4 });
  const url = await createAdminGateway(BASE, "t", fetcher).uploadTeamLogo("1", { name: "x.png", contentType: "image/png", bytes: new Uint8Array([1, 2, 3, 4]).buffer });
  assert.equal(url, "https://cdn.example.com/t.png");
  assert.equal(calls[0].url, `${BASE}/admin/teams/1/logo`);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], undefined);
  assert.ok(calls[0].init.body instanceof FormData);
  assert.equal(calls[0].init.body.get("file").type, "image/png");
  await rejectsCode(createAdminGateway(BASE, "t", async () => response({}, 413)).uploadTeamLogo("1", { name: "x.png", contentType: "image/png", bytes: new ArrayBuffer(1) }), "file-too-large");
  assert.equal(checkLogoFile({ type: "image/gif", size: 10 }) !== null, true);
  assert.equal(checkLogoFile({ type: "image/webp", size: 6 * 1024 * 1024 }) !== null, true);
  assert.equal(checkLogoFile({ type: "image/png", size: 1024 }), null);
});

// 7. Forms and list helpers
test("team form validation and normalization", () => {
  const ok = parseTeamForm({ entityId: " club-x ", name: " Club X ", shortName: "", gender: "women", genderKnown: "on", country: "esp", logoUrl: "", competitionId: "laliga" }, "create");
  assert.deepEqual(ok, { ok: true, value: { entityId: "club-x", name: "Club X", shortName: null, gender: "women", genderKnown: true, country: "ESP", logoUrl: null, competitionId: "laliga" } });
  const bad = parseTeamForm({ name: "", country: "EspaÃ±a", competitionId: "", logoUrl: "ftp://x", gender: "other" }, "create");
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.fields).sort(), ["competitionId", "country", "entityId", "gender", "logoUrl", "name"]);
  assert.equal(parseTeamForm({ name: "A", competitionId: "c" }, "edit").ok, true);
});

test("jornada, open and composicion forms convert Madrid times", () => {
  assert.deepEqual(parseJornadaForm({ status: "active", saleOpensAt: "2026-10-10T10:00", votingClosesAt: "" }),
    { ok: true, value: { status: "active", saleOpensAt: "2026-10-10T10:00:00+02:00", votingClosesAt: null } });
  assert.equal(parseJornadaForm({ status: "closed" }).ok, false);
  assert.equal(parseJornadaForm({ status: "draft", saleOpensAt: "2026-03-29T02:30" }).ok, false);
  assert.deepEqual(parseOpenForm({ saleOpensAt: "2026-12-01T09:00" }), { ok: true, value: { saleOpensAt: "2026-12-01T09:00:00+01:00" } });
  assert.equal(parseOpenForm({ saleOpensAt: "" }).ok, false);
  assert.deepEqual(parseComposicionForm({ homeTeamId: "4", awayTeamId: "9", kickoffAt: "", competition: " LaLiga " }),
    { ok: true, value: { homeTeamId: "4", awayTeamId: "9", kickoffAt: null, competition: "LaLiga" } });
  assert.equal(parseComposicionForm({ homeTeamId: "", awayTeamId: "x" }).ok, false);
});

test("client-side team filter, pagination and page parsing", () => {
  const teams = [
    { name: "Atlético de Madrid", shortName: "Atleti", entityId: "club-men-atletico", country: "ESP", competitionId: "laliga" },
    { name: "AC Milan", shortName: "Milan", entityId: "club-men-ac-milan", country: "ITA", competitionId: "uefa-europa-league" },
  ];
  assert.equal(filterTeams(teams, "").length, 2);
  assert.deepEqual(filterTeams(teams, "atletico").map(team => team.shortName), ["Atleti"]);
  assert.deepEqual(filterTeams(teams, " ita ").map(team => team.shortName), ["Milan"]);
  assert.equal(filterTeams(teams, "zzz").length, 0);
  assert.deepEqual(paginate([1, 2, 3], 2), { items: [1, 2], hasNext: true });
  assert.deepEqual(paginate([1, 2], 2), { items: [1, 2], hasNext: false });
  assert.deepEqual([pageOf("3"), pageOf("0"), pageOf("abc"), pageOf(undefined), pageOf("99999999")], [3, 1, 1, 1, 1]);
});
