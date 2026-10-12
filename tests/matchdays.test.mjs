import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createMatchdaysGateway } = require("../build/tests/features/matchdays/infrastructure/http-matchdays-gateway.js");
const { getMatchday, findActiveMatchday } = require("../build/tests/features/matchdays/application/matchdays.js");
const { phaseOf, canVote, canCreatePorra, canEditPorra, canSetBoleto, parseEffectivePhase, EFFECTIVE_PHASES, hasFullBoleto } = require("../build/tests/features/matchdays/domain/matchdays.js");
const { matchdayStateLabel, matchdayStateHint, votingClosedMessage, readOnlyNotice, boletoLockedMessage } = require("../build/tests/features/matchdays/domain/matchday-state.js");
const { ServiceError } = require("../build/tests/lib/http/errors.js");

const BASE = "https://api.example.com";
const wire = {
  id: 3, temporada: 2027, temporada_str: "2026/2027", numero: 8, status: "active", sale_opens_at: null,
  voting_closes_at: "2026-10-10T16:00:00Z", kickoff_first_match_at: "2026-10-10T18:00:00+00:00", fetched_at: "2026-10-04T12:00:00.123456+00:00",
};
const partido = (posicion, extra = {}) => ({ id: posicion, jornada_id: 3, posicion, local_team_id: 1, visitante_team_id: 2,
  local_raw: `Home ${posicion}`, visitante_raw: `Away ${posicion}`, competicion_raw: null, kickoff_at: null, fetched_at: wire.fetched_at, ...extra });
const response = (payload, status = 200) => new Response(JSON.stringify(payload), { status });
const capture = (payload, status = 200) => { const calls = []; return { calls, fetcher: async (url, init) => { calls.push({ url, init }); return response(payload, status); } }; };
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof ServiceError && error.code === code);

test("list maps a bare array, nullable dates and numeric ids; sends filters", async () => {
  const { fetcher, calls } = capture([wire]);
  const [result] = await createMatchdaysGateway(BASE, "t", fetcher).list({ status: "active", season: 2027, limit: 1 });
  assert.equal(calls[0].url, `${BASE}/jornadas?status=active&season=2027&limit=1`);
  assert.equal(calls[0].init.headers.Authorization, "Bearer t");
  assert.deepEqual(result, { id: "3", season: 2027, seasonLabel: "2026/2027", number: 8, status: "active", saleOpensAt: null,
    votingClosesAt: "2026-10-10T16:00:00Z", firstKickoffAt: "2026-10-10T18:00:00+00:00", fetchedAt: wire.fetched_at, deletedAt: null, effectivePhase: null, serverNow: null });
});

test("list without filters has no query string; missing optional dates become null", async () => {
  const { fetcher, calls } = capture([{ ...wire, voting_closes_at: undefined, kickoff_first_match_at: null }]);
  const [result] = await createMatchdaysGateway(BASE, "t", fetcher).list();
  assert.equal(calls[0].url, `${BASE}/jornadas`);
  assert.equal(result.votingClosesAt, null);
  assert.equal(result.firstKickoffAt, null);
});

test("detail orders fixtures by position and maps team names and nullable kickoff", async () => {
  const partidos = [partido(2, { kickoff_at: "2026-10-10T20:00:00Z" }), partido(1)];
  const { fetcher, calls } = capture({ ...wire, partidos });
  const result = await createMatchdaysGateway(BASE, "t", fetcher).get("3");
  assert.equal(calls[0].url, `${BASE}/jornadas/3`);
  assert.deepEqual(result.fixtures.map(f => f.position), [1, 2]);
  assert.equal(result.fixtures[0].home, "Home 1");
  assert.equal(result.fixtures[0].kickoffAt, null);
  assert.equal(result.fixtures[1].kickoffAt, "2026-10-10T20:00:00Z");
  assert.equal(result.fixtures[1].competition, null);
});

test("detail maps optional embedded teams to crest URLs, null when absent or not absolute", async () => {
  const partidos = [
    partido(1, { local_team: { id: 1, name: "Home 1", short_name: "H1", logo_url: "https://pub-x.r2.dev/h1.png", extra: true }, visitante_team: { id: 2, logo_url: null } }),
    partido(2, { local_team: { id: 1, logo_url: "data/team-assets/h2.png" } }),
    partido(3),
  ];
  const result = await createMatchdaysGateway(BASE, "t", capture({ ...wire, partidos }).fetcher).get("3");
  assert.equal(result.fixtures[0].homeLogoUrl, "https://pub-x.r2.dev/h1.png");
  assert.equal(result.fixtures[0].awayLogoUrl, null);
  assert.equal(result.fixtures[1].homeLogoUrl, null);
  assert.equal(result.fixtures[2].homeLogoUrl, null);
  assert.equal(result.fixtures[2].awayLogoUrl, null);
});

for (const [name, payload] of [
  ["an envelope instead of an array", { items: [wire], total: 1 }],
  ["an unknown status", [{ ...wire, status: "paused" }]],
  ["a bad timestamp", [{ ...wire, fetched_at: "yesterday" }]],
  ["a string id", [{ ...wire, id: "3" }]],
]) {
  test(`list rejects malformed payload: ${name}`, async () => {
    await rejectsCode(createMatchdaysGateway(BASE, "t", async () => response(payload)).list(), "malformed");
  });
}

test("detail rejects a position outside 1..15 and a missing partidos list", async () => {
  await rejectsCode(createMatchdaysGateway(BASE, "t", async () => response({ ...wire, partidos: [partido(16)] })).get("3"), "malformed");
  await rejectsCode(createMatchdaysGateway(BASE, "t", async () => response(wire)).get("3"), "malformed");
});

test("detail 404 maps to not-found and invalid ids never reach the gateway", async () => {
  await rejectsCode(createMatchdaysGateway(BASE, "t", async () => response({ detail: "jornada not found" }, 404)).get("3"), "not-found");
  let called = false;
  await rejectsCode(getMatchday({ get: async () => { called = true; } }, "abc"), "not-found");
  assert.equal(called, false);
});

test("findActiveMatchday returns the first active matchday or null", async () => {
  assert.equal(await findActiveMatchday({ list: async () => [] }), null);
  assert.deepEqual(await findActiveMatchday({ list: async filter => { assert.deepEqual(filter, { status: "active", limit: 1 }); return [{ id: "3" }]; } }), { id: "3" });
});

const md = (status, extra = {}) => ({ status, saleOpensAt: null, votingClosesAt: null, effectivePhase: null, serverNow: "2026-10-10T12:00:00Z", ...extra });

test("effective_phase and now are parsed; unknown or malformed values never fail the matchday", async () => {
  const gateway = payload => createMatchdaysGateway(BASE, "t", capture([payload]).fetcher);
  const [known] = await gateway({ ...wire, effective_phase: "in_window", now: "2026-10-10T12:00:00Z" }).list();
  assert.deepEqual([known.effectivePhase, known.serverNow], ["in_window", "2026-10-10T12:00:00Z"]);
  for (const bad of ["brand_new_phase", 7, null]) assert.equal((await gateway({ ...wire, effective_phase: bad }).list())[0].effectivePhase, null);
  const [noClock] = await gateway({ ...wire, now: "yesterday-ish" }).list();
  assert.equal(noClock.serverNow, null);
  const detail = await createMatchdaysGateway(BASE, "t", capture({ ...wire, effective_phase: "fuera_de_ventana", now: "2026-10-11T00:00:00Z", partidos: [partido(1)] }).fetcher).get("3");
  assert.equal(detail.effectivePhase, "fuera_de_ventana");
  assert.deepEqual(EFFECTIVE_PHASES.map(parseEffectivePhase), [...EFFECTIVE_PHASES]);
  assert.equal(parseEffectivePhase(undefined), null);
});

test("phase helpers allow exactly what the backend allows, for all 6 phases", () => {
  const table = {
    en_preparacion: [false, false, false, false],
    lista_abre_pronto: [false, false, true, true],
    in_window: [true, true, true, true],
    fuera_de_ventana: [false, false, false, true],
    escrutinio_pendiente: [false, false, false, true],
    escrutinio_disponible: [false, false, false, false],
  };
  assert.deepEqual(Object.keys(table), [...EFFECTIVE_PHASES]);
  for (const [phase, [vote, create, edit, boleto]] of Object.entries(table)) {
    assert.deepEqual([canVote(phase), canCreatePorra(phase), canEditPorra(phase), canSetBoleto(phase)], [vote, create, edit, boleto], phase);
  }
});

test("phaseOf trusts the backend phase and otherwise mirrors its derivation with the server clock", () => {
  assert.equal(phaseOf(md("active", { effectivePhase: "escrutinio_pendiente" })), "escrutinio_pendiente");
  // The backend phase wins even when the dates would say otherwise.
  assert.equal(phaseOf(md("active", { effectivePhase: "fuera_de_ventana", votingClosesAt: "2026-10-11T00:00:00Z" })), "fuera_de_ventana");
  assert.equal(phaseOf(md("draft")), "en_preparacion");
  assert.equal(phaseOf(md("past", { votingClosesAt: "2026-10-12T00:00:00Z" })), "escrutinio_disponible");
  assert.equal(phaseOf(md("active", { saleOpensAt: "2026-10-11T00:00:00Z", votingClosesAt: "2026-10-12T00:00:00Z" })), "lista_abre_pronto");
  assert.equal(phaseOf(md("active", { saleOpensAt: "2026-10-09T00:00:00Z", votingClosesAt: "2026-10-12T00:00:00Z" })), "in_window");
  assert.equal(phaseOf(md("active", { votingClosesAt: "2026-10-10T16:00:00Z" })), "in_window");
  assert.equal(phaseOf(md("active", { votingClosesAt: "2026-10-10T12:00:00Z" })), "fuera_de_ventana", "the deadline instant itself is closed");
  assert.equal(phaseOf(md("active", { votingClosesAt: "2026-10-09T16:00:00Z" })), "fuera_de_ventana");
  // Backend rule: no deadline means closed (not open forever).
  assert.equal(phaseOf(md("active")), "fuera_de_ventana");
  assert.equal(phaseOf(md("active", { saleOpensAt: "2026-10-09T00:00:00Z" })), "fuera_de_ventana");
  assert.equal(phaseOf(md("active", { votingClosesAt: "not a date" })), "fuera_de_ventana");
  // Without the server clock there is no safe reading of an active matchday: closed, never the client clock.
  assert.equal(phaseOf(md("active", { serverNow: null, votingClosesAt: "2999-01-01T00:00:00Z" })), "fuera_de_ventana");
});

test("hasFullBoleto needs positions 1..15", () => {
  const fixtures = Array.from({ length: 15 }, (_, i) => ({ position: i + 1 }));
  assert.equal(hasFullBoleto({ fixtures }), true);
  assert.equal(hasFullBoleto({ fixtures: fixtures.slice(0, 14) }), false);
});

test("state labels and messages come from the voting phase", () => {
  assert.equal(matchdayStateLabel(md("draft")), "Próximamente");
  assert.equal(matchdayStateLabel(md("active", { votingClosesAt: "2026-10-10T16:00:00Z" })), "Votación abierta");
  assert.equal(matchdayStateLabel(md("active", { votingClosesAt: "2026-10-10T11:00:00Z" })), "Votación cerrada");
  assert.equal(matchdayStateLabel(md("active", { saleOpensAt: "2026-10-11T11:00:00Z", votingClosesAt: "2026-10-12T11:00:00Z" })), "La venta abre pronto");
  assert.equal(matchdayStateLabel(md("past")), "Finalizada");
  assert.equal(matchdayStateLabel(md("active", { effectivePhase: "escrutinio_pendiente" })), "Finalizada");
  assert.equal(matchdayStateHint({ status: "draft" }), "La votación todavía no ha abierto");
  assert.equal(matchdayStateHint({ status: "active" }), null);
  assert.match(readOnlyNotice({ status: "draft" }, false), /todavía no ha abierto/);
  assert.match(readOnlyNotice({ status: "past" }, true), /solo de lectura/);
  assert.equal(votingClosedMessage(md("draft")), "La jornada aún está en preparación.");
  assert.match(votingClosedMessage(md("active", { saleOpensAt: "2026-10-11T08:00:00Z", votingClosesAt: "2026-10-12T11:00:00Z" })), /^La venta de esta jornada aún no ha abierto\. Se abre el .*11/);
  assert.match(votingClosedMessage(md("active", { votingClosesAt: "2026-10-10T11:00:00Z" })), /^El plazo de votación cerró el /);
  assert.equal(votingClosedMessage(md("active")), "El plazo de votación ha terminado.");
  assert.equal(votingClosedMessage(md("past")), "La jornada ha terminado.");
  assert.equal(boletoLockedMessage("in_window"), null);
  assert.equal(boletoLockedMessage("fuera_de_ventana"), null);
  assert.equal(boletoLockedMessage("lista_abre_pronto"), null);
  assert.match(boletoLockedMessage("en_preparacion"), /en preparación/);
  assert.equal(boletoLockedMessage("escrutinio_disponible"), "La jornada ya ha terminado: el boleto ya no se puede cambiar.");
});
