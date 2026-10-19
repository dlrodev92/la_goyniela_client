import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../build/tests/features/porras/domain/logic.js");
const C = require("../build/tests/features/porras/domain/columns.js");
const { createPorrasGateway } = require("../build/tests/features/porras/infrastructure/http-porras-gateway.js");
const { submitVote, VoteValidationError } = require("../build/tests/features/porras/application/porras.js");
const { ServiceError } = require("../build/tests/lib/http/errors.js");

const BASE = "https://api.example.com";
const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status });
const gw = fetcher => createPorrasGateway(BASE, "tok", fetcher);
const capture = (payload, status = 200) => { const calls = []; return { calls, fetcher: async (url, init) => { calls.push({ url, init }); return json(payload, status); } }; };
const rejectsCode = (promise, code) => assert.rejects(promise, e => e instanceof ServiceError && e.code === code);

const boletoInput = () => C.boletoInputFromColumns(C.columnsDraftFromSingle(fullDraft()));

const fullDraft = () => {
  let d = L.emptyDraft();
  for (let i = 1; i <= 14; i++) d = L.toggleSign(d, i, "1");
  d = L.setPleno(d, "home", "1");
  return L.setPleno(d, "away", "M");
};

test("columnsFor is 2^D * 3^T", () => {
  assert.equal(L.columnsFor(0, 0), 1);
  assert.equal(L.columnsFor(2, 1), 12);
  assert.equal(L.columnsFor(1, 1), 6);
  assert.equal(L.columnsFor(0, 14), 4782969);
});

test("costFor is decimal safe", () => {
  assert.equal(L.costFor(1, "0.75"), "0.75");
  assert.equal(L.costFor(2, "0.75"), "1.50");
  assert.equal(L.costFor(6, "0.75"), "4.50");
  assert.equal(L.costFor(12, "0.75"), "9.00");
  assert.equal(L.costFor(132, "0.75"), "99.00");
  assert.equal(L.costFor(7, "0.7500"), "5.25");
  assert.equal(L.costFor(3, "0.1"), "0.30");
  assert.equal(L.costFor(1, "abc"), null);
  assert.equal(L.costFor(1, "-1"), null);
});

test("kindOf classifies signs", () => {
  assert.equal(L.kindOf(["1"]), "simple");
  assert.equal(L.kindOf(["1", "X"]), "doble");
  assert.equal(L.kindOf(["1", "X", "2"]), "triple");
  assert.equal(L.kindOf([]), null);
});

test("toggleSign adds sorted and removes, without mutating", () => {
  const d0 = L.emptyDraft();
  const d1 = L.toggleSign(L.toggleSign(d0, 3, "2"), 3, "1");
  assert.deepEqual(d1.picks[2], ["1", "2"]);
  assert.deepEqual(d0.picks[2], []);
  assert.deepEqual(L.toggleSign(d1, 3, "1").picks[2], ["2"]);
});

test("validateVote reports Spanish errors per field", () => {
  const errors = L.validateVote(L.emptyDraft());
  assert.equal(Object.keys(errors).length, 16);
  assert.equal(errors["pick-3"], "Partido 3: marca al menos un signo.");
  assert.match(errors["pleno-home"], /local/);
  assert.deepEqual(L.validateVote(fullDraft()), {});
  assert.deepEqual(L.voteFromDraft(L.emptyDraft()), null);
  const vote = L.voteFromDraft(fullDraft());
  assert.equal(vote.columnas.length, 1);
  assert.equal(vote.columnas[0].length, 14);
  assert.deepEqual(vote.pleno, { home: "1", away: "M" });
});

test("formatUsage and overBudget", () => {
  let d = fullDraft();
  d = L.toggleSign(L.toggleSign(d, 1, "X"), 2, "X");
  d = L.toggleSign(L.toggleSign(d, 5, "X"), 5, "2");
  const usage = L.formatUsage(d);
  assert.deepEqual([usage.dobles, usage.triples, usage.columns], [2, 1, 12]);
  assert.equal(L.overBudget(usage, "9.00", "0.75"), false);
  assert.equal(L.overBudget(usage, "8.99", "0.75"), true);
  assert.equal(L.overBudget({ columns: 1 }, "0.75", "0.75"), false);
  assert.equal(L.overBudget({ columns: 1 }, "0.74", "0.75"), true);
  assert.equal(L.matchesFormat(usage, { dobles: 2, triples: 1 }), true);
  assert.equal(L.matchesFormat(usage, { dobles: 1, triples: 1 }), false);
});

test("rowText reads like the plan", () => {
  assert.equal(L.rowText(3, "Barcelona", "Getafe", ["X", "1"]), "Partido 3, Barcelona contra Getafe: 1 y X");
  assert.equal(L.rowText(4, "A", "B", ["1", "X", "2"]), "Partido 4, A contra B: 1, X y 2");
  assert.equal(L.rowText(5, "A", "B", []), "Partido 5, A contra B: sin marcar");
});

test("proposeGoals breaks ties toward fewer goals", () => {
  assert.equal(L.proposeGoals({ "0": 1, "1": 3, "2": 3, M: 0 }), "1");
  assert.equal(L.proposeGoals({ "0": 0, "1": 0, "2": 0, M: 0 }), "0");
  assert.equal(L.proposeGoals({ "0": 0, "1": 0, "2": 1, M: 2 }), "M");
});

test("submitPicks sends the wire body and maps a closed porra (403) to porra-closed", async () => {
  const { fetcher, calls } = capture({ porra_id: 5, show_picks: false, members: [] });
  await gw(fetcher).submitPicks("2", "5", L.voteFromDraft(fullDraft()));
  const body = JSON.parse(calls[0].init.body);
  assert.equal(calls[0].url, `${BASE}/groups/2/porras/5/picks`);
  assert.equal("picks" in body, false, "the API rejects the old `picks` key");
  assert.equal(body.columnas.length, 1);
  assert.equal(body.columnas[0].matches[0].partido_orden, 1);
  assert.deepEqual(body.pleno, { local: "1", visitante: "M" });
  await rejectsCode(gw(async () => json({ detail: "porra is closed" }, 403)).submitPicks("2", "5", L.voteFromDraft(fullDraft())), "porra-closed");
});

test("submitVote validates before calling the backend", async () => {
  let called = false;
  await assert.rejects(submitVote(gw(async () => { called = true; return json({}); }), "2", "5", C.columnsDraftFromSingle(L.emptyDraft())), e => e instanceof VoteValidationError);
  assert.equal(called, false);
});

test("myPicks and getBoleto turn 404 into null", async () => {
  assert.equal(await gw(async () => json({ detail: "no picks yet" }, 404)).myPicks("2", "5"), null);
  assert.equal(await gw(async () => json({ detail: "no boleto saved yet" }, 404)).getBoleto("2", "5"), null);
  await rejectsCode(gw(async () => json({}, 500)).getBoleto("2", "5"), "upstream");
});

test("myPicks maps rows and the pleno", async () => {
  const rows = [
    { partido_orden: 1, signs: ["X", "1"], pleno_local: null, pleno_visitante: null, local_team_id: 1, visitante_team_id: 2, columna_idx: 1, local_team: { canonical_name: "Barcelona", short_name: "Barça", logo_url: "https://x.test/a.png" }, visitante_team: null },
    { partido_orden: 15, signs: null, pleno_local: "2", pleno_visitante: "M", local_team_id: 1, visitante_team_id: 2, columna_idx: 1 },
  ];
  const sheet = await gw(async () => json(rows)).myPicks("2", "5");
  assert.deepEqual(sheet.picks, [{ position: 1, signs: ["1", "X"] }]);
  assert.deepEqual(sheet.pleno, { home: "2", away: "M" });
  assert.equal(sheet.matches[0].home.shortName, "Barça");
  assert.equal(sheet.matches[0].away, null);
});

const porraWire = { id: 5, group_id: 2, jornada_id: 11, created_by_user_id: 1, budget_eur: "3.00", dobles: 1, triples: 1, precio_apuesta_eur: "0.75", status: "open", created_at: "2026-10-05T10:00:00Z", updated_at: "2026-10-05T10:00:00Z", columns: 6, cost_eur: "4.50", has_boleto: false };

test("create keeps money as strings and maps 409/422", async () => {
  const { fetcher, calls } = capture({ ...porraWire, formats_preview: [{ dobles: 1, triples: 1, columns: 6, coste_eur: "4.50" }], participation: { voted: 0, total_members: 2, missing_voters: [{ user_id: 3, display_name: "Ana" }] } }, 201);
  const porra = await gw(fetcher).create("2", { jornadaId: "11", budgetEur: "3.00", spec: { modo: "multiple", dobles: 1, triples: 1 } });
  assert.deepEqual(JSON.parse(calls[0].init.body), { jornada_id: 11, budget_eur: "3.00", modo: "multiple", dobles: 1, triples: 1 }, "the price is never sent: the backend resolves it");
  assert.equal(porra.costEur, "4.50");
  assert.equal(porra.formatsPreview[0].costEur, "4.50");
  assert.equal(porra.participation.missingVoters[0].userId, "3");
  await rejectsCode(gw(async () => json({ detail: "porra already exists for group_id=2 (porra_id=5)" }, 409)).create("2", { jornadaId: "11", budgetEur: "3", spec: { modo: "multiple", dobles: 1, triples: 0 } }), "porra-exists");
  await rejectsCode(gw(async () => json({ detail: "format (D=1, T=1) costs 4.50€ ... which exceeds the budget 3€" }, 422)).create("2", { jornadaId: "11", budgetEur: "3", spec: { modo: "multiple", dobles: 1, triples: 1 } }), "over-budget");
  await rejectsCode(gw(async () => json({ detail: [{ msg: "x" }] }, 422)).create("2", { jornadaId: "11", budgetEur: "3", spec: { modo: "multiple", dobles: 1, triples: 1 } }), "invalid-porra");
});

const MIN_FORMAT_COPY = "El formato mínimo es de 2 columnas (1 doble o 1 triple).";
const MIN_FORMAT_TEXT = "minimum format is 2 columns (1 doble OR 1 triple). Quiniela does not sell 1-column boletos.";

test("the 422 minimum format maps to Spanish copy on create and patch, as a string or as a Pydantic array", async () => {
  const pydantic = [{ type: "value_error", loc: ["body"], msg: `Value error, ${MIN_FORMAT_TEXT} — set dobles=1 or triples=1`, input: {} }];
  for (const detail of [MIN_FORMAT_TEXT, pydantic]) {
    for (const call of [
      gw(async () => json({ detail }, 422)).create("2", { jornadaId: "11", budgetEur: "3", spec: { modo: "multiple", dobles: 1, triples: 0 } }),
      gw(async () => json({ detail }, 422)).patch("2", "5", { spec: { modo: "multiple", dobles: 0, triples: 0 } }),
    ]) {
      await rejectsCode(call, "min-format");
      await call.catch(error => assert.equal(error.message, MIN_FORMAT_COPY));
    }
  }
});

test("the boleto PUT 422s read as clear Spanish copy", async () => {
  const put = detail => gw(async () => json({ detail }, 422)).putBoleto("2", "5", boletoInput());
  const mismatch = await put("expected 2 dobles in the boleto, got 0").catch(error => error);
  assert.equal(mismatch.code, "format-mismatch");
  assert.match(mismatch.message, /debe tener 2 dobles y tiene 0/);
  const simples = await put("expected 13 simples in the boleto, got 14").catch(error => error);
  assert.match(simples.message, /debe tener 13 simples y tiene 14/);
  const over = await put("boleto costs 9.00€ (columns=12 × 0.75€), exceeds the budget 6.00€").catch(error => error);
  assert.equal(over.code, "over-budget");
  assert.match(over.message, /El boleto cuesta más que el presupuesto/);
});

test("patch maps 409 closed and boleto lock; put maps format mismatch", async () => {
  await rejectsCode(gw(async () => json({ detail: "porra is closed — cannot patch" }, 409)).patch("2", "5", { spec: { modo: "multiple", dobles: 0, triples: 0 } }), "porra-closed");
  await rejectsCode(gw(async () => json({ detail: "new format (D=0, T=0) does not match the persisted boleto (D=1, T=1)." }, 422)).patch("2", "5", { spec: { modo: "multiple", dobles: 0, triples: 0 } }), "boleto-locked");
  await rejectsCode(gw(async () => json({ detail: "expected 1 dobles in the boleto, got 0" }, 422)).putBoleto("2", "5", boletoInput()), "format-mismatch");
});

const columnWire = signs => ({ matches: Array.from({ length: 14 }, (_, i) => ({ partido_orden: i + 1, signs: signs[i] ?? ["2"] })) });

test("getBoleto maps the final boleto with its columns, mode and reduction", async () => {
  const wire = { porra_id: 5, modo: "reducida", set_at: "2026-10-05T10:00:00Z", set_by_user_id: 1, columnas: [columnWire([["X", "1"]])], pleno: { local: "0", visitante: "2" }, columns: 24, cost_eur: "18.00", reduccion: "R3" };
  const boleto = await gw(async () => json(wire)).getBoleto("2", "5");
  assert.equal(boleto.modo, "reducida");
  assert.equal(boleto.reduccion, "R3");
  assert.equal(boleto.columnas.length, 1);
  assert.deepEqual(boleto.columnas[0][0], { position: 1, signs: ["1", "X"] });
  assert.deepEqual(boleto.pleno, { home: "0", away: "2" });
  assert.deepEqual([boleto.columns, boleto.costEur], [24, "18.00"], "apuestas and cost are the API's, not 14 rows' worth");
  const sencilla = await gw(async () => json({ ...wire, modo: "sencilla", columnas: [columnWire([]), columnWire([]), columnWire([])], columns: 3, cost_eur: "2.25", reduccion: null })).getBoleto("2", "5");
  assert.equal(sencilla.columnas.length, 3);
  assert.equal(sencilla.reduccion, null);
  // The legacy top-level `matches` is no longer read: a body without `columnas` is malformed.
  await rejectsCode(gw(async () => json({ porra_id: 5, set_at: wire.set_at, set_by_user_id: 1, matches: columnWire([]).matches, pleno: wire.pleno, columns: 2, cost_eur: "1.50" })).getBoleto("2", "5"), "malformed");
  await rejectsCode(gw(async () => json({ ...wire, columnas: [{ matches: columnWire([]).matches.slice(1) }] })).getBoleto("2", "5"), "malformed");
});

test("submitPicks maps 403 to voting-closed and flags the rows of a 422", async () => {
  const vote = { columnas: [Array.from({ length: 14 }, (_, i) => ({ position: i + 1, signs: ["1"] }))], pleno: { home: "1", away: "0" } };
  await rejectsCode(gw(async () => json({ detail: "porra is closed" }, 403)).submitPicks("2", "5", vote), "porra-closed");
  const detail = [{ loc: ["body", "columnas", 0, "matches", 2, "signs"], msg: "x" }, { loc: ["body", "pleno", "local"], msg: "y" }, { loc: ["body"], msg: "z" }];
  await assert.rejects(gw(async () => json({ detail }, 422)).submitPicks("2", "5", vote), (error) => {
    assert.equal(error.code, "invalid-picks");
    assert.deepEqual(error.invalidMatches, [3, 15]);
    return true;
  });
});

test("draft progress, storage round trip and 422 flags", () => {
  const base = L.emptyDraft();
  assert.deepEqual(L.draftProgress(base), { marked: 0, plenoDone: false });
  const draft = L.setPleno(L.setPleno(L.toggleSign(base, 3, "X"), "home", "1"), "away", "M");
  assert.deepEqual(L.draftProgress(draft), { marked: 1, plenoDone: true });
  const raw = L.encodeDraft(base, draft);
  assert.deepEqual(L.decodeDraft(raw, base), draft);
  assert.equal(L.decodeDraft(raw, draft), null, "a draft from another baseline is dropped");
  assert.equal(L.decodeDraft("{oops", base), null);
  assert.equal(L.decodeDraft(JSON.stringify({ base, draft: { picks: [], pleno: {} } }), base), null);
  assert.deepEqual(Object.keys(L.flaggedFields([3, 15])).sort(), ["pick-3", "pleno-away", "pleno-home"]);
});

test("porra view helpers", () => {
  const V = require("../build/tests/features/porras/domain/porra-view.js");
  const base = { dobles: 0, triples: 0, fijos: null, columnas: null, reduccion: null };
  assert.equal(V.porraFormatLabel({ ...base, modo: "multiple", dobles: 1, triples: 1 }), "Múltiple · 1 doble + 1 triple");
  assert.equal(V.porraFormatLabel({ ...base, modo: "multiple", dobles: 2 }), "Múltiple · 2 dobles");
  assert.equal(V.porraFormatLabel({ ...base, modo: "sencilla", columnas: 6 }), "Sencilla · 6 columnas");
  assert.equal(V.porraFormatLabel({ ...base, modo: "reducida", dobles: 3, triples: 3 }), "Reducida R3 · 3 dobles + 3 triples", "the code is derived from (dobles, triples) when the API omits it");
  assert.equal(V.porraFormatLabel({ ...base, modo: "intuicion", fijos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], columnas: 6 }), "Intuición · 10 fijos y 4 variables");
  assert.equal(V.porraFormatLabel({ ...base, modo: "intuicion", fijos: [2, 6, 13], columnas: 3 }), "Intuición · 3 fijos y 11 variables");
  assert.equal(L.formatName(0, 0), "solo simples");
  const active = { status: "active", saleOpensAt: null, votingClosesAt: "2026-10-10T10:00:00Z", effectivePhase: null, serverNow: "2026-10-06T10:00:00Z" };
  assert.deepEqual(V.votingGate({ status: "open" }, active, true), { open: true, reason: null });
  assert.deepEqual(V.votingGate({ status: "unknown" }, active, true), { open: true, reason: null });
  assert.equal(V.votingGate({ status: "closed" }, active, true).reason, "La porra está cerrada.");
  assert.equal(V.votingGate({ status: "open" }, { ...active, votingClosesAt: "2026-10-01T10:00:00Z" }, true).open, false);
  // The server phase wins over the dates, and a porra that is still "open" cannot vote outside the window.
  assert.equal(V.votingGate({ status: "open" }, { ...active, effectivePhase: "fuera_de_ventana" }, true).open, false);
  assert.equal(V.votingGate({ status: "open" }, { ...active, effectivePhase: "escrutinio_disponible" }, true).reason, "La jornada ha terminado.");
  assert.match(V.votingGate({ status: "open" }, { ...active, effectivePhase: "lista_abre_pronto" }, true).reason, /aún no ha abierto/);
  assert.match(V.votingGate({ status: "open" }, active, false).reason, /todavía no están completos/);
  const fixtures = [{ position: 1, home: "Barcelona", away: "Getafe", homeShortName: "Barça", awayShortName: null, kickoffAt: null }];
  const losilla = { matches: [{ position: 1, day: "SAB", time: "14:00", score: { home: 2, away: 1 }, comment: "Clásico", percentages: { one: 60, x: 25, two: 15 } }], bote: null, escrutinio: null };
  const [info] = V.buildMatchInfo(fixtures, losilla);
  assert.deepEqual([info.home, info.away, info.schedule, info.result, info.resultSign, info.percentages.one], ["Barça", "Getafe", "Sáb 14:00", "2-1", "1", 60]);
  assert.equal(V.buildMatchInfo(fixtures, null)[0].percentages, null);
  assert.equal(V.percentValue(130), 100);
});

test("isValidFormat never accepts (0, 0) and columns follow 2^D * 3^T", () => {
  assert.equal(L.isValidFormat(0, 0), false);
  assert.equal(L.isValidFormat(1, 0), true);
  assert.equal(L.isValidFormat(0, 1), true);
  assert.equal(L.isValidFormat(8, 7), false, "more than 14 upgraded matches");
  assert.equal(L.isValidFormat(-1, 2), false);
  assert.equal(L.columnsFor(1, 0), 2);
  assert.equal(L.formatCost(1, 0, "0.75"), "1.50");
  assert.equal(L.formatCost(0, 1, "0.75"), "2.25");
  assert.equal(L.formatCost(1, 1, "0.75"), "4.50");
});

test("formatOptions uses the API columns and cost, drops (0, 0) and sorts most columns first", () => {
  const api = (dobles, triples, columns, costEur) => ({ dobles, triples, columns, costEur });
  const backend = [api(1, 0, 2, "1.50"), api(0, 0, 1, "0.75"), api(0, 1, 3, "2.25"), api(2, 0, 4, "3.00"), api(1, 1, 6, "4.50")];
  const options = L.formatOptions(backend, "3.00");
  assert.deepEqual(options.map(o => [o.dobles, o.triples, o.columns, o.costEur]), [[2, 0, 4, "3.00"], [0, 1, 3, "2.25"], [1, 0, 2, "1.50"]]);
  assert.equal(options.some(o => o.dobles === 0 && o.triples === 0), false);
  assert.deepEqual(L.formatOptions(backend, "1.00"), [], "even the smallest format (2 columns, 1,50) does not fit");
  assert.equal(L.formatOptions([api(1, 1, 6, "4.50")], "4.50").length, 1, "exact budget fits");
  // A different API price flows through untouched (no 0,75 repricing on the client).
  assert.deepEqual(L.formatOptions([api(1, 0, 2, "1.00")], "1.00").map(o => o.costEur), ["1.00"]);
  assert.equal(L.pricePerColumn(options), "0.75");
  assert.equal(L.pricePerColumn([]), null);
});

test("format labels read like the plan", () => {
  assert.equal(L.formatOptionLabel({ dobles: 1, triples: 0, columns: 2, costEur: "1.50" }), "1 doble · 2 columnas · 1,50 €");
  assert.equal(L.formatOptionLabel({ dobles: 1, triples: 1, columns: 6, costEur: "4.50" }), "1 doble + 1 triple · 6 columnas · 4,50 €");
  assert.equal(L.formatOptionLabel({ dobles: 2, triples: 0, columns: 4, costEur: "3.00" }), "2 dobles · 4 columnas · 3,00 €");
  assert.equal(L.formatName(0, 2), "2 triples");
});

test("parseBudget accepts Spanish and plain decimals only", () => {
  assert.equal(L.parseBudget("6"), "6.00");
  assert.equal(L.parseBudget(" 6,5 € "), "6.50");
  assert.equal(L.parseBudget("12.25"), "12.25");
  for (const bad of ["", "0", "abc", "-3", "1,2,3", "20000"]) assert.equal(L.parseBudget(bad), null, bad);
});

test("sharesOf gives rounded percentages that sum 100", () => {
  assert.deepEqual(L.sharesOf({ "1": 0.5, X: 0.5, "2": 0 }), { "1": 50, X: 50, "2": 0 });
  assert.deepEqual(L.sharesOf({ "1": 1, X: 1, "2": 1 }), { "1": 34, X: 33, "2": 33 });
  assert.deepEqual(L.sharesOf({ "1": 1.5, X: 0.5, "2": 0 }), { "1": 75, X: 25, "2": 0 });
  assert.deepEqual(L.sharesOf({ "1": 0, X: 0, "2": 0 }), { "1": 0, X: 0, "2": 0 });
  const odd = L.sharesOf({ "1": 2, X: 1, "2": 4 });
  assert.equal(odd["1"] + odd.X + odd["2"], 100);
});

test("draftFromPropuesta marks the proposed signs and the proposed pleno", () => {
  const matches = Array.from({ length: 14 }, (_, i) => ({ position: i + 1, weights: { "1": 1, X: 0, "2": 0 }, signs: i === 1 ? ["X", "1"] : ["1"], kind: i === 1 ? "doble" : "simple" }));
  const draft = L.draftFromPropuesta({ matches, pleno: { home: "1", away: "0" } });
  assert.deepEqual(draft.picks[1], ["1", "X"]);
  assert.deepEqual(draft.pleno, { home: "1", away: "0" });
});

const TERMS = { dobles: 1, triples: 1, budgetEur: "6.00", precioApuestaEur: "0.75" };
const editable = (doble, triple) => {
  let d = fullDraft();
  if (doble) d = L.toggleSign(d, 1, "X");
  if (triple) { d = L.toggleSign(d, 2, "X"); d = L.toggleSign(d, 2, "2"); }
  return d;
};

test("editCheck counts dobles, triples, columns and cost live", () => {
  const ok = L.editCheck(editable(true, true), TERMS);
  assert.deepEqual([ok.usage.dobles, ok.usage.triples, ok.columns, ok.costEur, ok.over, ok.matches, ok.canConfirm], [1, 1, 6, "4.50", false, true, true]);
  assert.deepEqual([ok.formatColumns, ok.formatCostEur, ok.remaining], [6, "4.50", { dobles: 0, triples: 0 }]);
  assert.deepEqual(ok.reasons, []);
});

test("editCheck blocks a boleto that does not match the format, with Spanish reasons", () => {
  const none = L.editCheck(editable(false, false), TERMS);
  assert.equal(none.canConfirm, false);
  assert.deepEqual(none.reasons, ["Te falta 1 doble por colocar.", "Te falta 1 triple por colocar."]);
  const extra = L.editCheck(L.toggleSign(editable(true, true), 3, "X"), TERMS);
  assert.deepEqual(extra.reasons, ["Te sobra 1 doble.", "El boleto cuesta 9,00 € y el presupuesto es de 6,00 €."]);
  const gap = L.editCheck(L.toggleSign(editable(true, true), 5, "1"), TERMS);
  assert.deepEqual(gap.reasons.slice(0, 1), ["Falta 1 partido por marcar."]);
  const noPleno = L.editCheck({ ...editable(true, true), pleno: { home: "1", away: null } }, TERMS);
  assert.deepEqual(noPleno.reasons, ["Elige los goles de los dos equipos del pleno al 15."]);
});

test("editCheck blocks a boleto over the budget", () => {
  const tight = { ...TERMS, budgetEur: "3.00" };
  const check = L.editCheck(editable(true, true), tight);
  assert.equal(check.over, true);
  assert.equal(check.canConfirm, false);
  assert.ok(check.reasons.some(reason => /cuesta 4,50 € y el presupuesto es de 3,00 €/.test(reason)), check.reasons.join("|"));
});

test("a legacy boleto saved with 14 simples shows what is missing instead of crashing", () => {
  const legacy = L.editCheck(fullDraft(), { dobles: 1, triples: 0, budgetEur: "3.00", precioApuestaEur: "0.75" });
  assert.deepEqual([legacy.columns, legacy.costEur, legacy.formatColumns, legacy.formatCostEur], [1, "0.75", 2, "1.50"]);
  assert.deepEqual(legacy.remaining, { dobles: 1, triples: 0 });
  assert.deepEqual(legacy.reasons, ["Te falta 1 doble por colocar."]);
  assert.equal(legacy.canConfirm, false);
});

test("admin application calls validate before reaching the backend and never send the price", async () => {
  const A = require("../build/tests/features/porras/application/porras.js");
  const { calls, fetcher } = capture({});
  const g = gw(fetcher);
  await rejectsCode(A.listFormats(g, "2", "11", "0"), "invalid-porra");
  await rejectsCode(A.listFormats(g, "x", "11", "6"), "not-found");
  await rejectsCode(A.createPorra(g, "2", { jornadaId: "11", budgetEur: "6.00", spec: { modo: "multiple", dobles: 15, triples: 0 } }), "invalid-porra");
  await rejectsCode(A.patchPorra(g, "2", "5", { budgetEur: "abc" }), "invalid-porra");
  await rejectsCode(A.createPorra(g, "2", { jornadaId: "11", budgetEur: "6.00", spec: { modo: "multiple", dobles: 0, triples: 0 } }), "invalid-porra");
  await rejectsCode(A.patchPorra(g, "2", "5", { spec: { modo: "multiple", dobles: 0, triples: 0 } }), "invalid-porra");
  await rejectsCode(A.patchPorra(g, "2", "5", {}), "invalid-porra");
  assert.equal(calls.length, 0);
  const created = capture({ id: 5, group_id: 2, jornada_id: 11, created_by_user_id: 1, budget_eur: "6.00", dobles: 1, triples: 1, precio_apuesta_eur: "0.75", status: "open", created_at: "2026-10-06T10:00:00Z", updated_at: "2026-10-06T10:00:00Z", columns: 6, cost_eur: "4.50", has_boleto: false }, 201);
  await A.createPorra(gw(created.fetcher), "2", { jornadaId: "11", budgetEur: "6.00", spec: { modo: "multiple", dobles: 1, triples: 1 } });
  assert.equal("precio_apuesta_eur" in JSON.parse(created.calls[0].init.body), false);
  await assert.rejects(A.saveFinalBoleto(g, "2", "5", C.columnsDraftFromSingle(L.emptyDraft())), e => e instanceof A.VoteValidationError);
  assert.equal(calls.length, 0);
});

test("porraTotals takes columns and cost straight from the format, with no sencilla minimum", () => {
  const V = require("../build/tests/features/porras/domain/porra-view.js");
  assert.deepEqual(V.porraTotals({ dobles: 1, triples: 0, columns: 2, costEur: "1.50", precioApuestaEur: "0.75" }), { columns: 2, costEur: "1.50" });
  assert.deepEqual(V.porraTotals({ dobles: 1, triples: 1, columns: 6, costEur: "4.50", precioApuestaEur: "0.75" }), { columns: 6, costEur: "4.50" });
  // Without API totals they derive from the format and the porra's own price.
  assert.deepEqual(V.porraTotals({ dobles: 2, triples: 0, columns: 0, costEur: "", precioApuestaEur: "0.50" }), { columns: 4, costEur: "2.00" });
  // A legacy (0, 0) porra is shown as the API reports it, not inflated.
  assert.deepEqual(V.porraTotals({ dobles: 0, triples: 0, columns: 1, costEur: "0.75", precioApuestaEur: "0.75" }), { columns: 1, costEur: "0.75" });
  assert.equal(V.columnsLabel(1), "1 columna");
  assert.equal(V.columnsLabel(2), "2 columnas");
});

test("create, patch and put parse the 409 body: string rules vs structured window refusals", async () => {
  const create = detail => gw(async () => json({ detail }, 409)).create("2", { jornadaId: "11", budgetEur: "3", spec: { modo: "multiple", dobles: 1, triples: 0 } });
  const patch = detail => gw(async () => json({ detail }, 409)).patch("2", "5", { spec: { modo: "multiple", dobles: 0, triples: 0 } });
  const put = detail => gw(async () => json({ detail }, 409)).putBoleto("2", "5", boletoInput());
  // String details are porra rules.
  await rejectsCode(create("porra already exists for group_id=2 (porra_id=5)"), "porra-exists");
  await rejectsCode(patch("porra is closed — cannot patch"), "porra-closed");
  // An unknown string is a plain conflict, not a guessed porra rule.
  await rejectsCode(create("something else"), "conflict");
  await rejectsCode(patch("something else"), "conflict");
  await rejectsCode(put("something else"), "conflict");
  await rejectsCode(put(undefined), "conflict");
  // Dict details are window refusals, one code per phase, in every call.
  const window = { jornada_in_preparation: "jornada-in-preparation", sale_not_yet_opened: "sale-not-opened", voting_window_closed: "voting-window-closed", escrutinio_pending: "escrutinio-pending", escrutinio_disponible: "escrutinio-disponible" };
  for (const [wire, code] of Object.entries(window)) {
    const detail = { code: wire, sale_opens_at: null, voting_closes_at: null, now: "2026-10-06T10:00:00Z", effective_phase: "x" };
    for (const call of [create, patch, put]) await rejectsCode(call(detail), code);
  }
  // The sale date from the body is part of the copy, formatted in Madrid time.
  await assert.rejects(create({ code: "sale_not_yet_opened", sale_opens_at: "2026-10-12T08:00:00Z" }), error => error.code === "sale-not-opened" && /Se abre el .*10:00/.test(error.message));
  // The boleto has its own wording for a finished jornada; the other calls keep the short one.
  await assert.rejects(put({ code: "escrutinio_disponible" }), error => error.message === "La jornada ya ha terminado: el boleto ya no se puede cambiar.");
  await assert.rejects(create({ code: "escrutinio_disponible" }), error => error.message === "La jornada ha terminado.");
  await rejectsCode(put({ code: "mystery" }), "conflict");
});

test("porra status is lenient: open/closed pass through, anything else is unknown", async () => {
  const get = status => gw(async () => json({ ...porraWire, status })).get("2", "5");
  assert.equal((await get("open")).status, "open");
  assert.equal((await get("closed")).status, "closed");
  assert.equal((await get("archived")).status, "unknown");
  assert.equal((await get("")).status, "unknown");
});

test("porraLifecycle follows the jornada phase; a closed status stays an override", () => {
  const { porraLifecycle, porraLifecycleLabel, isVotable } = require("../build/tests/features/porras/domain/lifecycle.js");
  const state = (phase, hasBoleto = false, status = "open") => porraLifecycle({ phase, hasBoleto, status });
  assert.equal(state("en_preparacion"), "preparing");
  assert.equal(state("lista_abre_pronto"), "voting-soon");
  assert.equal(state("lista_abre_pronto", true), "voting-soon");
  assert.equal(state("in_window"), "voting-open");
  assert.equal(state("in_window", true), "voting-open");
  assert.equal(state("fuera_de_ventana"), "awaiting-boleto");
  assert.equal(state("fuera_de_ventana", true), "boleto-confirmed");
  assert.equal(state("escrutinio_pendiente"), "awaiting-boleto");
  assert.equal(state("escrutinio_pendiente", true), "boleto-confirmed");
  assert.equal(state("escrutinio_disponible"), "finished");
  assert.equal(state("escrutinio_disponible", true), "finished");
  // An open (or unknown) status says nothing; the backend never writes closed today, but when it does it wins.
  assert.equal(state("fuera_de_ventana", false, "unknown"), "awaiting-boleto");
  for (const phase of ["in_window", "lista_abre_pronto", "fuera_de_ventana", "en_preparacion"]) assert.equal(state(phase, true, "closed"), "finished");
  assert.deepEqual(
    ["voting-open", "voting-soon", "awaiting-boleto", "boleto-confirmed", "finished", "preparing"].map(porraLifecycleLabel),
    ["Votación abierta", "La venta abre pronto", "Votación cerrada · falta el boleto", "Boleto confirmado", "Finalizada", "En preparación"],
  );
  assert.deepEqual(["voting-open", "voting-soon", "awaiting-boleto", "boleto-confirmed", "finished", "preparing"].map(isVotable), [true, false, false, false, false, false]);
});
