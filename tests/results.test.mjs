import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createResultsGateway } = require("../build/tests/features/results/infrastructure/http-results-gateway.js");
const { getEscrutinio, getMatchResults, listResultMatchdays } = require("../build/tests/features/results/application/results.js");
const { parseScore, signOf, hasPublishedPrizes } = require("../build/tests/features/results/domain/results.js");
const { ServiceError } = require("../build/tests/lib/http/errors.js");

const BASE = "https://api.example.com";
const response = (payload, status = 200) => new Response(payload === undefined ? null : JSON.stringify(payload), { status });
const capture = (payload, status = 200) => { const calls = []; return { calls, fetcher: async (url, init) => { calls.push({ url, init }); return response(payload, status); } }; };
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof ServiceError && error.code === code);
const matchday = { season: 2027, number: 8 };

const partido = (orden, resultado) => ({ orden, num: orden, local: `Home ${orden}`, visitante: `Away ${orden}`, resultado, extra: "ignored" });
const live = (partidos, extra = {}) => ({ jornada: 8, temporada: 2027, ssr_shipped_jornada: 8, warning: null, partidos, ...extra });
const escrutinio = (extra = {}) => ({
  source: "db",
  escrutinio: {
    estimada: false, recaudacion_eur: "1.453.174,50", bote_eur: "0,00", jornada_etiqueta: 8, temporada_etiqueta: "26/27", fecha_jornada: "10/10/2026",
    categorias: [{ aciertos: 15, acertantes: 0, premio_eur: "0,00" }, { aciertos: 14, acertantes: 12, premio_eur: "1.008,51" }],
    elige8: { acertantes: 3, premio_eur: "50,00" }, ...extra,
  },
});

test("getMatches maps scores, sorts by position and requests the live endpoint with season and number", async () => {
  const { fetcher, calls } = capture(live([partido(2, "null-null"), partido(1, "2-1"), partido(15, "1-3")]));
  const { matches } = await getMatchResults(createResultsGateway(BASE, "t", fetcher), matchday);
  assert.equal(calls[0].url, `${BASE}/api/v1/losilla/jornada/8?temporada=2027`);
  assert.equal(calls[0].init.headers.Authorization, "Bearer t");
  assert.deepEqual(matches.map(m => m.position), [1, 2, 15]);
  assert.deepEqual(matches[0], { position: 1, home: "Home 1", away: "Away 1", score: { home: 2, away: 1 } });
  assert.equal(matches[1].score, null);
  assert.equal(matches[0].extra, undefined);
});

test("getMatches refuses scores that belong to another matchday", async () => {
  await rejectsCode(createResultsGateway(BASE, "t", capture(live([partido(1, "1-0")], { ssr_shipped_jornada: 9 })).fetcher).getMatches(2027, 8), "not-found");
  await rejectsCode(createResultsGateway(BASE, "t", capture(live([partido(1, "1-0")], { jornada: 9 })).fetcher).getMatches(2027, 8), "not-found");
});

test("results and escrutinio map 502 to upstream and 404 to not-found", async () => {
  const gateway = (status) => createResultsGateway(BASE, "t", capture({ detail: "Upstream returned 500 private-detail" }, status).fetcher);
  await rejectsCode(gateway(502).getMatches(2027, 8), "upstream");
  await rejectsCode(gateway(502).getEscrutinio(2027, 8), "upstream");
  await rejectsCode(gateway(404).getMatches(2027, 8), "not-found");
  await rejectsCode(gateway(404).getEscrutinio(2027, 8), "not-found");
  await rejectsCode(gateway(401).getMatches(2027, 8), "unauthenticated");
});

test("malformed results payloads are rejected", async () => {
  const bad = [
    ["missing partidos", { jornada: 8, temporada: 2027 }],
    ["position out of range", live([partido(16, "1-0")])],
    ["non-string team", live([{ ...partido(1, "1-0"), local: 7 }])],
  ];
  for (const [, payload] of bad) await rejectsCode(createResultsGateway(BASE, "t", capture(payload).fetcher).getMatches(2027, 8), "malformed");
});

test("getEscrutinio maps the prize table and keeps provider money strings untouched", async () => {
  const { fetcher, calls } = capture(escrutinio());
  const result = await getEscrutinio(createResultsGateway(BASE, "t", fetcher), matchday);
  assert.equal(calls[0].url, `${BASE}/api/v1/losilla/jornada/8/escrutinio?temporada=2027`);
  assert.equal(result.estimated, false);
  assert.equal(result.collectedEur, "1.453.174,50");
  assert.deepEqual(result.categories[1], { hits: 14, winners: 12, prizeEur: "1.008,51" });
  assert.deepEqual(result.elige8, { winners: 3, prizeEur: "50,00" });
  assert.equal(result.source, "db");
});

test("getEscrutinio returns null for 204 and for a block labelled with another matchday", async () => {
  assert.equal(await getEscrutinio(createResultsGateway(BASE, "t", async () => new Response(null, { status: 204 })), matchday), null);
  assert.equal(await getEscrutinio(createResultsGateway(BASE, "t", capture(escrutinio({ jornada_etiqueta: 9 })).fetcher), matchday), null);
});

test("malformed escrutinio payloads are rejected", async () => {
  await rejectsCode(createResultsGateway(BASE, "t", capture(escrutinio({ categorias: "none" })).fetcher).getEscrutinio(2027, 8), "malformed");
  await rejectsCode(createResultsGateway(BASE, "t", capture({ source: "cache", escrutinio: escrutinio().escrutinio }).fetcher).getEscrutinio(2027, 8), "malformed");
  await rejectsCode(createResultsGateway(BASE, "t", capture(escrutinio({ categorias: [{ aciertos: 14, acertantes: -1, premio_eur: "1,00" }] })).fetcher).getEscrutinio(2027, 8), "malformed");
});

test("invalid matchday coordinates never reach the gateway", async () => {
  const gateway = { getMatches: async () => assert.fail("called"), getEscrutinio: async () => assert.fail("called") };
  await rejectsCode(getMatchResults(gateway, { season: 2027, number: 0 }), "not-found");
  await rejectsCode(getEscrutinio(gateway, { season: Number.NaN, number: 3 }), "not-found");
});

test("listResultMatchdays drops drafts", async () => {
  const gateway = { list: async () => [{ id: "1", status: "draft" }, { id: "2", status: "active" }, { id: "3", status: "completed" }] };
  assert.deepEqual((await listResultMatchdays(gateway)).map(m => m.id), ["2", "3"]);
});

test("parseScore and signOf", () => {
  assert.deepEqual(parseScore("2-1"), { home: 2, away: 1 });
  for (const value of ["null-null", "", null, undefined, "2:1", "abc"]) assert.equal(parseScore(value), null);
  assert.equal(signOf({ home: 2, away: 1 }), "1");
  assert.equal(signOf({ home: 1, away: 1 }), "X");
  assert.equal(signOf({ home: 0, away: 3 }), "2");
});

test("hasPublishedPrizes is false for the all-zero placeholder and true once any row has data", () => {
  const row = (winners, prizeEur) => ({ hits: 15, winners, prizeEur });
  assert.equal(hasPublishedPrizes({ categories: [], elige8: null }), false);
  assert.equal(hasPublishedPrizes({ categories: [row(0, "0,00"), row(0, "")], elige8: { winners: 0, prizeEur: "0,00" } }), false);
  assert.equal(hasPublishedPrizes({ categories: [row(0, "0,00"), row(12, "1.008,51")], elige8: null }), true);
  assert.equal(hasPublishedPrizes({ categories: [row(0, "250.000,00")], elige8: null }), true);
  assert.equal(hasPublishedPrizes({ categories: [row(0, "0,00")], elige8: { winners: 3, prizeEur: "50,00" } }), true);
});
