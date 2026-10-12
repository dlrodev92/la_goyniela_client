import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createMatchdaysGateway } = require("../build/tests/features/matchdays/infrastructure/http-matchdays-gateway.js");
const { createResultsGateway } = require("../build/tests/features/results/infrastructure/http-results-gateway.js");
const { createAuthGateway } = require("../build/tests/features/auth/infrastructure/http-auth-gateway.js");
const { createPorrasGateway, classifyPicksRefusal } = require("../build/tests/features/porras/infrastructure/http-porras-gateway.js");
const { listMatchdays, getMatchday, findActiveMatchday } = require("../build/tests/features/matchdays/application/matchdays.js");
const { getLosillaJornada } = require("../build/tests/features/results/application/results.js");
const { isVisibleMatchday } = require("../build/tests/features/matchdays/domain/matchdays.js");
const { ServiceError, parseRetryAfter, rateLimitMessage } = require("../build/tests/lib/http/errors.js");
const { loginErrorFor, loginErrorMessage } = require("../build/tests/features/auth/domain/oauth.js");
const { mergeEstimates } = require("../build/tests/features/jornadas/domain/estimates.js");
const { calendarDayOf, calendarInstantOf, calendarDayOfMatchday, splitForCalendar, kickoffLabelOf, DATE_TO_CONFIRM } = require("../build/tests/features/jornadas/domain/calendar.js");
const { pickNextActiveMatchday, buildTickerChips } = require("../build/tests/features/jornadas/domain/ticker.js");
const { groupByJornada, buildMatchInfo } = require("../build/tests/features/porras/domain/porra-view.js");

const BASE = "https://api.example.com";
const json = (payload, status = 200, headers = {}) => new Response(payload === undefined ? null : JSON.stringify(payload), { status, headers });
const respond = (payload, status = 200, headers = {}) => { const calls = []; return { calls, fetcher: async (url, init) => { calls.push({ url, init }); return json(payload, status, headers); } }; };
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof ServiceError && error.code === code);

const wire = (extra = {}) => ({ id: 3, temporada: 2027, temporada_str: "2026/2027", numero: 8, status: "active", fetched_at: "2026-10-04T12:00:00Z", ...extra });
const md = (id, number, status, extra = {}) => ({ id: String(id), season: 2026, seasonLabel: "2026/2027", number, status, saleOpensAt: null, votingClosesAt: null, firstKickoffAt: null, fetchedAt: "", deletedAt: null, ...extra });

// 1a. Status mapping

test("matchday status is draft | active | past; the retired closed and completed are malformed", async () => {
  for (const status of ["draft", "active", "past"]) {
    const [result] = await createMatchdaysGateway(BASE, "t", respond([wire({ status })]).fetcher).list();
    assert.equal(result.status, status);
  }
  for (const status of ["closed", "completed"]) await rejectsCode(createMatchdaysGateway(BASE, "t", respond([wire({ status })]).fetcher).list(), "malformed");
});

// 1b. Draft visibility

test("regular users never get draft or soft-deleted matchdays in lists", async () => {
  const gateway = { list: async () => [md(1, 1, "draft"), md(2, 2, "active"), md(3, 3, "past"), md(4, 4, "active", { deletedAt: "2026-10-01T00:00:00Z" })] };
  assert.deepEqual((await listMatchdays(gateway)).map(m => m.id), ["2", "3"]);
  assert.equal(isVisibleMatchday({ status: "draft", deletedAt: null }), false);
  assert.equal(isVisibleMatchday({ status: "past", deletedAt: null }), true);
  assert.equal(await findActiveMatchday({ list: async () => [md(9, 9, "draft")] }), null);
});

test("a draft or soft-deleted matchday detail is not found", async () => {
  await rejectsCode(getMatchday({ get: async () => ({ ...md(1, 1, "draft"), fixtures: [], estimates: [] }) }, "1"), "not-found");
  await rejectsCode(getMatchday({ get: async () => ({ ...md(1, 1, "active", { deletedAt: "2026-10-01T00:00:00Z" }), fixtures: [], estimates: [] }) }, "1"), "not-found");
  assert.equal((await getMatchday({ get: async () => ({ ...md(1, 1, "active"), fixtures: [], estimates: [] }) }, "1")).id, "1");
});

// 1c. deleted_at

test("deleted_at is optional and nullable on jornadas and teams", async () => {
  const team = { id: 1, canonical_name: "Rayo", short_name: "Rayo", logo_url: "https://r2.example/rayo.png", deleted_at: null };
  const detail = wire({ deleted_at: null, partidos: [{ posicion: 1, local_raw: "Rayo", visitante_raw: "Athletic", local_team: team, visitante_team: { ...team, deleted_at: "2026-10-01T00:00:00Z" } }] });
  const result = await createMatchdaysGateway(BASE, "t", respond(detail).fetcher).get("3");
  assert.equal(result.deletedAt, null);
  assert.equal(result.fixtures[0].homeLogoUrl, team.logo_url);
  const [deleted] = await createMatchdaysGateway(BASE, "t", respond([wire({ deleted_at: "2026-10-02T09:00:00Z" })]).fetcher).list();
  assert.equal(deleted.deletedAt, "2026-10-02T09:00:00Z");
});

// 1d. is_superadmin

test("is_superadmin is optional and defaults to false", async () => {
  const user = { id: 1, email: "a@b.co", display_name: "A", avatar_url: null };
  assert.equal((await createAuthGateway(BASE, async () => json(user)).currentUser("t")).isSuperadmin, false);
  assert.equal((await createAuthGateway(BASE, async () => json({ ...user, is_superadmin: true })).currentUser("t")).isSuperadmin, true);
});

// 1e. 429

test("Retry-After parses seconds and dates, clamped; garbage is null", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(parseRetryAfter("60"), 60);
  assert.equal(parseRetryAfter(" 7 "), 7);
  assert.equal(parseRetryAfter("0"), 1);
  assert.equal(parseRetryAfter("999999"), 3600);
  assert.equal(parseRetryAfter("Thu, 08 Oct 2026 12:00:30 GMT", now), 30);
  assert.equal(parseRetryAfter("Thu, 08 Oct 2026 11:00:00 GMT", now), 1);
  for (const value of [null, undefined, "", "soon", "-5", "1.5"]) assert.equal(parseRetryAfter(value, now), null);
});

test("a 429 becomes a typed rate-limit error with the wait and is never retried", async () => {
  const { fetcher, calls } = respond({ detail: "private-detail" }, 429, { "Retry-After": "60" });
  await assert.rejects(createMatchdaysGateway(BASE, "t", fetcher).list(), error => {
    assert.ok(error instanceof ServiceError);
    assert.equal(error.code, "rate-limit");
    assert.equal(error.retryAfterSeconds, 60);
    assert.equal(error.message, "Demasiadas solicitudes, reinténtalo en 60s");
    return true;
  });
  assert.equal(calls.length, 1);
  await assert.rejects(createMatchdaysGateway(BASE, "t", respond({}, 429).fetcher).list(), error => error.code === "rate-limit" && error.retryAfterSeconds === null && /Espera un momento/.test(error.message));
  assert.equal(rateLimitMessage(12), "Demasiadas solicitudes, reinténtalo en 12s");
  assert.equal(new ServiceError("upstream", { retryAfterSeconds: 9 }).retryAfterSeconds, null);
});

// 1f. Error copy

test("picks refusals tell every jornada phase apart and keep non-members out of the voting-closed copy", async () => {
  const byPhase = { en_preparacion: "jornada-in-preparation", lista_abre_pronto: "sale-not-opened", fuera_de_ventana: "voting-window-closed", escrutinio_pendiente: "escrutinio-pending", escrutinio_disponible: "escrutinio-disponible" };
  for (const [phase, code] of Object.entries(byPhase)) assert.equal(classifyPicksRefusal({ effective_phase: phase }), code, phase);
  const byCode = { jornada_in_preparation: "jornada-in-preparation", sale_not_yet_opened: "sale-not-opened", voting_window_closed: "voting-window-closed", escrutinio_pending: "escrutinio-pending", escrutinio_disponible: "escrutinio-disponible" };
  for (const [wire, code] of Object.entries(byCode)) assert.equal(classifyPicksRefusal({ code: wire, effective_phase: "in_window" }), code, wire);
  assert.equal(classifyPicksRefusal({ effective_phase: "in_window" }), "voting-closed");
  assert.equal(classifyPicksRefusal({ code: "constructor" }), "voting-closed");
  assert.equal(classifyPicksRefusal("porra is closed"), "porra-closed");
  assert.equal(classifyPicksRefusal("not a member of this group"), "forbidden");
  assert.equal(classifyPicksRefusal("jornada is not active"), "jornada-in-preparation");
  assert.equal(classifyPicksRefusal("voting deadline passed"), "voting-window-closed");
  assert.equal(classifyPicksRefusal("nope"), "voting-closed");
  assert.equal(classifyPicksRefusal(undefined), "voting-closed");
  assert.equal(new ServiceError("jornada-in-preparation").message, "La jornada aún está en preparación.");
  assert.equal(new ServiceError("sale-not-opened").message, "La venta de esta jornada aún no ha abierto.");
  assert.equal(new ServiceError("voting-window-closed").message, "El plazo de votación ha terminado.");
  assert.equal(new ServiceError("escrutinio-pending").message, "La jornada ha terminado.");
  assert.equal(new ServiceError("escrutinio-disponible").message, "La jornada ha terminado.");
  const vote = { columnas: [Array.from({ length: 14 }, (_, i) => ({ position: i + 1, signs: ["1"] }))], pleno: { home: "1", away: "0" } };
  const gateway = (payload, status) => createPorrasGateway(BASE, "t", async () => json(payload, status));
  for (const [wire, code] of Object.entries(byCode)) {
    await rejectsCode(gateway({ detail: { code: wire, effective_phase: "x" } }, 409).submitPicks("1", "2", vote), code);
  }
  await rejectsCode(gateway({ detail: { code: "voting_window_closed", effective_phase: "fuera_de_ventana" } }, 409).submitPicks("1", "2", vote), "voting-window-closed");
  await rejectsCode(gateway({ detail: { code: "jornada_in_preparation", effective_phase: "en_preparacion" } }, 409).submitPicks("1", "2", vote), "jornada-in-preparation");
  await rejectsCode(gateway({ detail: "voting deadline passed" }, 403).submitPicks("1", "2", vote), "voting-window-closed");
  await rejectsCode(gateway({ detail: "not a member of this group" }, 403).submitPicks("1", "2", vote), "forbidden");
  await rejectsCode(gateway({ detail: "who knows" }, 403).submitPicks("1", "2", vote), "voting-closed");
  await rejectsCode(gateway({ detail: "something odd" }, 409).submitPicks("1", "2", vote), "conflict");
  // The sale date from the 409 body reaches the copy (Madrid time), and a missing date keeps the plain copy.
  await assert.rejects(gateway({ detail: { code: "sale_not_yet_opened", sale_opens_at: "2026-10-12T08:00:00Z", effective_phase: "lista_abre_pronto" } }, 409).submitPicks("1", "2", vote),
    error => error.code === "sale-not-opened" && /^La venta de esta jornada aún no ha abierto\. Se abre el .*10:00/.test(error.message));
  await assert.rejects(gateway({ detail: { code: "sale_not_yet_opened", sale_opens_at: null } }, 409).submitPicks("1", "2", vote),
    error => error.message === "La venta de esta jornada aún no ha abierto.");
});

test("X login tells a provider outage (502) from rejected credentials (401)", async () => {
  const gateway = status => createAuthGateway(BASE, async () => json({ detail: "private-detail" }, status));
  await assert.rejects(gateway(502).loginWithProvider("x", "t"), error => error.code === "provider-down" && !error.message.includes("private-detail"));
  await assert.rejects(gateway(401).loginWithProvider("x", "t"), error => error.code === "provider");
  assert.equal(loginErrorFor("x", "provider-down"), "x_down");
  assert.equal(loginErrorFor("google", "provider-down"), "provider_down");
  assert.equal(loginErrorFor("x", "credentials-rejected"), "oauth_rejected");
  assert.equal(loginErrorFor("x", "other"), "oauth_failed");
  assert.equal(loginErrorMessage("x_down"), "El servicio de X no está disponible. Inténtalo más tarde.");
  assert.notEqual(loginErrorMessage("oauth_rejected"), loginErrorMessage("x_down"));
});

// 2. Percentages

const losillaWire = (partidos) => ({ jornada: 12, temporada: 2027, ssr_shipped_jornada: 12, partidos });
const losillaPartido = (orden, extra = {}) => ({ orden, local: "RAYO", visitante: "ATH.CLUB", local_corto: "RAYO", visitante_corto: "ATHC", dia: "SAB", hora: "14:00", resultado: "null-null",
  uno_porcentaje: 35, x_porcentaje: 28, dos_porcentaje: 37, pleno_local: null, pleno_visitante: null, ...extra });

test("Losilla partidos expose short names, 1X2 shares and the pleno splits", async () => {
  const payload = losillaWire([
    losillaPartido(1),
    losillaPartido(2, { uno_porcentaje: null, x_porcentaje: null, dos_porcentaje: null }),
    losillaPartido(15, { uno_porcentaje: null, x_porcentaje: null, dos_porcentaje: null, pleno_local: { 0: 9, 1: 22, 2: 26, M: 43 }, pleno_visitante: { 0: 44, 1: 36, 2: 15, M: 5 } }),
  ]);
  const result = await getLosillaJornada(createResultsGateway(BASE, "t", respond(payload).fetcher), { season: 2026, number: 12 });
  const [first, second, pleno] = result.matches;
  assert.deepEqual(first.percentages, { one: 35, x: 28, two: 37 });
  assert.equal(first.homeShort, "RAYO");
  assert.equal(first.awayShort, "ATHC");
  assert.equal(second.percentages, undefined);
  assert.deepEqual(pleno.pleno, { home: { 0: 9, 1: 22, 2: 26, M: 43 }, away: { 0: 44, 1: 36, 2: 15, M: 5 } });
});

test("estimaciones of the jornada detail are parsed; a malformed or absent block is empty", async () => {
  const estimaciones = [
    { partido_orden: 2, uno_porcentaje: 40.5, x_porcentaje: 30, dos_porcentaje: 29.5, fuente: "losilla_live", fetched_at: "2026-10-08T00:00:00Z" },
    { partido_orden: 15, pleno_local: { 0: 10, 1: 20, 2: 30, M: 40 }, pleno_visitante: { 0: 40, 1: 30, 2: 20, M: 10 } },
    { partido_orden: 1, uno_porcentaje: 50, x_porcentaje: null, dos_porcentaje: 50 },
  ];
  const detail = await createMatchdaysGateway(BASE, "t", respond(wire({ partidos: [], estimaciones })).fetcher).get("3");
  assert.deepEqual(detail.estimates.map(e => e.position), [1, 2, 15]);
  assert.equal(detail.estimates[0].percentages, null);
  assert.deepEqual(detail.estimates[1].percentages, { one: 40.5, x: 30, two: 29.5 });
  assert.deepEqual(detail.estimates[2].pleno.home, { 0: 10, 1: 20, 2: 30, M: 40 });
  assert.deepEqual((await createMatchdaysGateway(BASE, "t", respond(wire({ partidos: [] })).fetcher).get("3")).estimates, []);
  assert.deepEqual((await createMatchdaysGateway(BASE, "t", respond(wire({ partidos: [], estimaciones: "nope" })).fetcher).get("3")).estimates, []);
});

test("percentages come from estimaciones first and Losilla for what they do not cover", () => {
  const own = [{ position: 1, percentages: { one: 10, x: 20, two: 70 }, pleno: null }, { position: 2, percentages: null, pleno: null }];
  const losilla = [
    { position: 1, percentages: { one: 33, x: 33, two: 34 } },
    { position: 2, percentages: { one: 50, x: 25, two: 25 } },
    { position: 3, day: "SAB" },
    { position: 15, pleno: { home: { 0: 1 }, away: { M: 2 } } },
  ];
  const merged = mergeEstimates(own, losilla);
  assert.deepEqual(merged.get(1).percentages, { one: 10, x: 20, two: 70 });
  assert.deepEqual(merged.get(2).percentages, { one: 50, x: 25, two: 25 });
  assert.equal(merged.has(3), false);
  assert.deepEqual(merged.get(15).pleno, { home: { 0: 1 }, away: { M: 2 } });
  assert.equal(mergeEstimates([], []).size, 0);
  // field by field: persisted 1X2 plus Losilla's pleno
  const mixed = mergeEstimates([{ position: 15, percentages: null, pleno: null }, { position: 4, percentages: { one: 1, x: 2, two: 3 }, pleno: null }], [{ position: 4, pleno: { home: { M: 1 }, away: { M: 2 } } }]);
  assert.deepEqual(mixed.get(4), { position: 4, percentages: { one: 1, x: 2, two: 3 }, pleno: { home: { M: 1 }, away: { M: 2 } } });
  assert.equal(mixed.has(15), false);
});

test("the boleto info uses the merged percentages", () => {
  const fixtures = [{ position: 1, home: "A", away: "B", kickoffAt: null }, { position: 15, home: "C", away: "D", kickoffAt: null }];
  const infos = buildMatchInfo(fixtures, { matches: [{ position: 1, day: null, time: null, score: null, comment: null, percentages: { one: 1, x: 2, two: 3 } }], bote: null, escrutinio: null },
    [{ position: 1, percentages: { one: 60, x: 30, two: 10 }, pleno: null }, { position: 15, percentages: null, pleno: { home: { M: 50 }, away: { 0: 50 } } }]);
  assert.deepEqual(infos[0].percentages, { one: 60, x: 30, two: 10 });
  assert.deepEqual(infos[1].pleno, { home: { M: 50 }, away: { 0: 50 } });
  assert.equal(buildMatchInfo(fixtures, null)[0].percentages, null);
});

// 3. Calendar

test("calendar day is formatted in es-ES, Europe/Madrid", () => {
  assert.deepEqual(calendarDayOf("2026-10-10T18:00:00Z"), { weekday: "SÁB", day: "10", month: "OCT" });
  assert.deepEqual(calendarDayOf("2026-10-14T09:00:00Z"), { weekday: "MIÉ", day: "14", month: "OCT" });
  assert.deepEqual(calendarDayOf("2026-09-12T10:00:00Z"), { weekday: "SÁB", day: "12", month: "SEP" });
  // 23:30 UTC on Saturday is already Sunday in Madrid (CEST, +2)
  assert.deepEqual(calendarDayOf("2026-10-10T22:30:00Z"), { weekday: "DOM", day: "11", month: "OCT" });
  // winter time (CET, +1)
  assert.deepEqual(calendarDayOf("2026-12-06T23:30:00Z"), { weekday: "LUN", day: "7", month: "DIC" });
  for (const value of [null, "", "garbage"]) assert.equal(calendarDayOf(value), null);
  assert.equal(kickoffLabelOf("2026-10-10T12:00:00Z"), "SÁB 14:00");
  assert.equal(kickoffLabelOf(null), null);
});

test("a calendar card is dated by the first kickoff, then the voting deadline, else it is to confirm", () => {
  assert.equal(calendarInstantOf({ firstKickoffAt: "2026-10-10T12:00:00Z", votingClosesAt: "2026-10-09T12:00:00Z" }), "2026-10-10T12:00:00Z");
  assert.equal(calendarInstantOf({ firstKickoffAt: null, votingClosesAt: "2026-10-09T12:00:00Z" }), "2026-10-09T12:00:00Z");
  assert.equal(calendarInstantOf({ firstKickoffAt: "bad", votingClosesAt: "2026-10-09T12:00:00Z" }), "2026-10-09T12:00:00Z");
  assert.equal(calendarInstantOf({ firstKickoffAt: null, votingClosesAt: null }), null);
  assert.equal(calendarDayOfMatchday({ firstKickoffAt: null, votingClosesAt: null }), null);
  assert.equal(DATE_TO_CONFIRM, "Fecha por confirmar");
});

test("the calendar splits upcoming (soonest first, undated last) from past and hides drafts", () => {
  const all = [
    md(1, 12, "draft"),
    md(2, 9, "active", { firstKickoffAt: "2026-10-17T12:00:00Z" }),
    md(3, 8, "active", { firstKickoffAt: "2026-10-10T12:00:00Z" }),
    md(4, 11, "active"),
    md(5, 10, "active"),
    md(6, 7, "past"),
    md(7, 6, "past"),
    md(8, 13, "active", { deletedAt: "2026-10-01T00:00:00Z" }),
  ];
  const { upcoming, past } = splitForCalendar(all);
  assert.deepEqual(upcoming.map(m => m.id), ["3", "2", "5", "4"]);
  assert.deepEqual(past.map(m => m.id), ["6", "7"]);
  assert.deepEqual(splitForCalendar([md(1, 1, "draft")]), { upcoming: [], past: [] });
});

// 4. Ticker

test("the ticker follows the active jornada with the earliest first kickoff (ties and nulls by lowest number)", () => {
  const pick = list => pickNextActiveMatchday(list)?.id ?? null;
  assert.equal(pick([]), null);
  assert.equal(pick([md(1, 5, "draft"), md(2, 4, "past")]), null);
  assert.equal(pick([md(1, 9, "active", { firstKickoffAt: "2026-10-17T12:00:00Z" }), md(2, 10, "active", { firstKickoffAt: "2026-10-10T12:00:00Z" })]), "2");
  assert.equal(pick([md(1, 10, "active", { firstKickoffAt: "2026-10-10T12:00:00Z" }), md(2, 9, "active", { firstKickoffAt: "2026-10-10T12:00:00Z" })]), "2");
  assert.equal(pick([md(1, 9, "active"), md(2, 10, "active", { firstKickoffAt: "2026-10-10T12:00:00Z" })]), "2");
  assert.equal(pick([md(1, 11, "active"), md(2, 10, "active")]), "2");
  assert.equal(pick([md(1, 3, "active", { deletedAt: "2026-10-01T00:00:00Z" })]), null);
});

test("ticker chips: kickoff or Losilla schedule, result when played, Losilla short names first", () => {
  const fixture = (position, extra = {}) => ({ position, home: `Home ${position}`, away: `Away ${position}`, kickoffAt: null, competition: null, homeLogoUrl: null, awayLogoUrl: null, ...extra });
  const fixtures = [
    fixture(2, { kickoffAt: "2026-10-10T12:00:00Z", homeShortName: "Albacete", awayShortName: "Eibar", homeLogoUrl: "https://r2.example/a.png" }),
    fixture(1),
    fixture(3),
    fixture(4, { kickoffAt: "2026-10-10T12:00:00Z" }),
  ];
  const losilla = [
    { position: 1, day: "SAB", time: "14:00", score: null, comment: null, homeShort: "RAYO", awayShort: "ATHC" },
    { position: 2, day: "DOM", time: "16:00", score: null, comment: null },
    { position: 4, day: "SAB", time: "14:00", score: { home: 2, away: 1 }, comment: null },
  ];
  const chips = buildTickerChips(fixtures, losilla);
  assert.deepEqual(chips.map(c => c.position), [1, 2, 3, 4]);
  assert.equal(chips[0].label, "SÁB 14:00");
  assert.deepEqual([chips[0].homeName, chips[0].awayName], ["RAYO", "ATHC"]);
  assert.equal(chips[1].label, "SÁB 14:00", "kickoff_at wins over the Losilla schedule");
  assert.deepEqual([chips[1].homeName, chips[1].awayName], ["ALBACETE", "EIBAR"]);
  assert.equal(chips[1].homeLogoUrl, "https://r2.example/a.png");
  assert.equal(chips[2].label, null);
  assert.equal(chips[2].homeName, "HOME 3");
  assert.deepEqual([chips[3].label, chips[3].played], ["2-1", true]);
});

// 1g. Jornada picker

test("porras are grouped by active jornada, lowest first; jornadas without porras are dropped", () => {
  const matchdays = [{ id: "20", number: 12, seasonLabel: "s" }, { id: "10", number: 11, seasonLabel: "s" }, { id: "30", number: 13, seasonLabel: "s" }];
  const entries = [{ porra: { id: "a", jornadaId: "20" } }, { porra: { id: "b", jornadaId: "10" } }, { porra: { id: "c", jornadaId: "99" } }];
  const choices = groupByJornada(matchdays, entries);
  assert.deepEqual(choices.map(c => [c.number, c.items.map(i => i.porra.id)]), [[11, ["b"]], [12, ["a"]]]);
  assert.deepEqual(groupByJornada(matchdays, []), []);
});
