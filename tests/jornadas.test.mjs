import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createResultsGateway } = require("../build/tests/features/results/infrastructure/http-results-gateway.js");
const { getLosillaJornada, losillaSeasonOf } = require("../build/tests/features/results/application/results.js");
const { createMatchdaysGateway } = require("../build/tests/features/matchdays/infrastructure/http-matchdays-gateway.js");
const { filterMatchdays, parseStatusFilter, scheduleLabel, keyDateOf } = require("../build/tests/features/jornadas/domain/jornadas.js");
const { STANDINGS, standingsFrameView } = require("../build/tests/features/jornadas/domain/standings.js");
const { formatEuro, parseAmount } = require("../build/tests/lib/format-money.js");

const BASE = "https://api.example.com";
const response = (payload, status = 200) => new Response(payload === undefined ? null : JSON.stringify(payload), { status });
const capture = (payload, status = 200) => { const calls = []; return { calls, fetcher: async (url) => { calls.push(url); return response(payload, status); } }; };
const matchday = { season: 2026, number: 11 };

const partido = (orden, extra = {}) => ({ orden, dia: "SAB", hora: "14:00", resultado: "2-1", comentario: "  Texto  ", ...extra });
const official = (extra = {}) => ({
  estimada: true, recaudacion_eur: "1,00", bote_eur: "0,00", jornada_etiqueta: 11, temporada_etiqueta: "26/27", fecha_jornada: "03/10/2026",
  categorias: [{ aciertos: 14, acertantes: 1, premio_eur: "195.310,50" }], elige8: null, ...extra,
});
const live = (extra = {}) => ({
  jornada: 11, temporada: 2027, ssr_shipped_jornada: 11,
  recaudacion_bote_live: { recaudacion_eur: "3.250.000,00", bote_estimado_eur: "725.525,54", bote_eur: "1500000", coste_apuesta_eur: "0.75", fecha_fin_apuestas_ts: 1791630000 },
  escrutinio_oficial: official(), partidos: [partido(2, { resultado: "null-null", comentario: "" }), partido(1)], ...extra,
});

test("Losilla jornada is requested with the end-year season and mapped", async () => {
  const { fetcher, calls } = capture(live());
  const result = await getLosillaJornada(createResultsGateway(BASE, "t", fetcher), matchday);
  assert.equal(calls[0], `${BASE}/api/v1/losilla/jornada/11?temporada=${losillaSeasonOf(2026)}`);
  assert.equal(losillaSeasonOf(2026), 2027);
  assert.deepEqual(result.matches.map(m => m.position), [1, 2]);
  assert.deepEqual(result.matches[0], { position: 1, day: "SAB", time: "14:00", score: { home: 2, away: 1 }, comment: "Texto" });
  assert.equal(result.matches[1].score, null);
  assert.equal(result.matches[1].comment, null);
  assert.equal(result.bote.jackpotEur, "1500000");
  assert.equal(result.bote.betCostEur, "0.75");
  assert.equal(result.bote.bettingClosesAt, new Date(1791630000 * 1000).toISOString());
  assert.equal(result.escrutinio.estimated, true);
});

test("a live view of another jornada drops matches and pool but keeps a correctly labelled escrutinio", async () => {
  const result = await getLosillaJornada(createResultsGateway(BASE, "t", capture(live({ ssr_shipped_jornada: 12 })).fetcher), matchday);
  assert.deepEqual(result.matches, []);
  assert.equal(result.bote, null);
  assert.equal(result.escrutinio.matchdayLabel, 11);
  const other = await getLosillaJornada(createResultsGateway(BASE, "t", capture(live({ ssr_shipped_jornada: 12, escrutinio_oficial: official({ jornada_etiqueta: 12 }) })).fetcher), matchday);
  assert.equal(other.escrutinio, null);
});

test("Losilla tolerates missing blocks, 204 and rejects other-jornada payloads and 502", async () => {
  const bare = await getLosillaJornada(createResultsGateway(BASE, "t", capture({ jornada: 11, temporada: 2027, partidos: [], recaudacion_bote_live: null, escrutinio_oficial: null }).fetcher), matchday);
  assert.deepEqual(bare, { matches: [], bote: null, escrutinio: null });
  assert.equal(await getLosillaJornada(createResultsGateway(BASE, "t", capture(undefined, 204).fetcher), matchday), null);
  await assert.rejects(getLosillaJornada(createResultsGateway(BASE, "t", capture(live({ jornada: 12 })).fetcher), matchday), error => error.code === "not-found");
  await assert.rejects(getLosillaJornada(createResultsGateway(BASE, "t", capture({ detail: "x" }, 502).fetcher), matchday), error => error.code === "upstream");
});

test("fixtures expose short and canonical team names from the embedded teams", async () => {
  const team = (id, canonical, short) => ({ id, entity_id: `e${id}`, canonical_name: canonical, short_name: short, logo_url: "https://r2.example/x.png" });
  const wire = {
    id: 1, temporada: 2026, temporada_str: "2026/2027", numero: 11, status: "active", fetched_at: "2026-10-05T13:33:01Z",
    partidos: [{ posicion: 1, local_raw: "Albacete", visitante_raw: "Eibar", local_team: team(1, "Albacete Balompié", "Albacete"), visitante_team: null }],
  };
  const detail = await createMatchdaysGateway(BASE, "t", capture(wire).fetcher).get("1");
  const [fixture] = detail.fixtures;
  assert.equal(fixture.homeShortName, "Albacete");
  assert.equal(fixture.homeFullName, "Albacete Balompié");
  assert.equal(fixture.awayShortName, null);
  assert.equal(fixture.homeLogoUrl, "https://r2.example/x.png");
});

const md = (id, season, number, status) => ({ id: String(id), season, number, status, seasonLabel: "x", saleOpensAt: null, votingClosesAt: null, firstKickoffAt: null, fetchedAt: "", deletedAt: null });

test("list hides drafts, puts active first, then newest first; chips filter by status", () => {
  const all = [md(1, 2026, 3, "past"), md(2, 2026, 11, "draft"), md(3, 2026, 5, "active"), md(4, 2025, 40, "past"), md(5, 2026, 12, "draft")];
  assert.deepEqual(filterMatchdays(all, null).map(m => m.id), ["3", "1", "4"]);
  assert.deepEqual(filterMatchdays(all, "draft").map(m => m.id), []);
  assert.deepEqual(filterMatchdays(all, "past").map(m => m.id), ["1", "4"]);
  assert.equal(parseStatusFilter("active"), "active");
  assert.equal(parseStatusFilter("past"), "past");
  assert.equal(parseStatusFilter("closed"), null);
  assert.equal(parseStatusFilter(["past", "x"]), "past");
});

test("schedule prefers Losilla day and time, then kickoff, then nothing", () => {
  assert.equal(scheduleLabel({ day: "SAB", time: "14:00" }, null), "Sáb 14:00");
  assert.equal(scheduleLabel({ day: "MIE", time: null }, null), "Mié");
  assert.equal(scheduleLabel(undefined, null), null);
  assert.match(scheduleLabel(undefined, "2026-10-10T18:00:00Z"), /10/);
  assert.equal(keyDateOf({ votingClosesAt: null, firstKickoffAt: null }), null);
  assert.equal(keyDateOf({ votingClosesAt: "2026-10-12T13:00:00Z", firstKickoffAt: "2026-10-13T13:00:00Z" }).label, "Cierre de votación");
  assert.equal(keyDateOf({ votingClosesAt: null, firstKickoffAt: "2026-10-13T13:00:00Z" }).label, "Primer partido");
});

test("money strings in Spanish and plain forms are normalized", () => {
  assert.equal(parseAmount("3.250.000,00"), 3250000);
  assert.equal(parseAmount("1500000"), 1500000);
  assert.equal(parseAmount("0.75"), 0.75);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(null), null);
  assert.equal(formatEuro("1500000").replace(/\s/g, " "), "1.500.000 €");
  assert.equal(formatEuro("0.75", { fixed: true }).replace(/\s/g, " "), "0,75 €");
  assert.equal(formatEuro("725.525,54").replace(/\s/g, " "), "725.525,54 €");
  assert.equal(formatEuro("x"), null);
});

test("standings config has six unique entries served from https Sofascore widgets", () => {
  assert.equal(STANDINGS.length, 6);
  assert.equal(new Set(STANDINGS.map(embed => embed.id)).size, 6);
  for (const embed of STANDINGS) {
    const src = new URL(embed.src);
    assert.equal(src.protocol, "https:");
    assert.equal(src.hostname, "widgets.sofascore.com");
    assert.ok(embed.height > 0);
    assert.equal(new URL(embed.attributionUrl).protocol, "https:");
  }
});

test("standings frame view only covers the iframe with the skeleton while loading", () => {
  assert.equal(standingsFrameView("loading").skeleton, true);
  assert.equal(standingsFrameView("loaded").skeleton, false);
  assert.equal(standingsFrameView("slow").skeleton, false);
  for (const state of ["loading", "loaded", "slow"]) assert.ok(standingsFrameView(state).message.length > 0);
});
