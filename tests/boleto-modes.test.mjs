import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../build/tests/features/porras/domain/logic.js");
const C = require("../build/tests/features/porras/domain/columns.js");
const M = require("../build/tests/features/porras/domain/modes.js");
const V = require("../build/tests/features/porras/domain/porra-view.js");
const A = require("../build/tests/features/porras/application/porras.js");
const { createPorrasGateway, boletoMismatch } = require("../build/tests/features/porras/infrastructure/http-porras-gateway.js");
const { ServiceError } = require("../build/tests/lib/http/errors.js");

const BASE = "https://api.example.com";
const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status });
const gw = fetcher => createPorrasGateway(BASE, "tok", fetcher);
const capture = (payload, status = 200) => { const calls = []; return { calls, fetcher: async (url, init) => { calls.push({ url, init }); return json(payload, status); } }; };
const rejectsCode = (promise, code) => assert.rejects(promise, e => e instanceof ServiceError && e.code === code);

const porraWire = (extra = {}) => ({
  id: 5, group_id: 2, jornada_id: 11, created_by_user_id: 1, budget_eur: "6.00", dobles: 0, triples: 0, modo: "sencilla", fijos: null, columnas: 6,
  precio_apuesta_eur: "0.75", status: "open", created_at: "2026-10-05T10:00:00Z", updated_at: "2026-10-05T10:00:00Z", columns: 6, cost_eur: "4.50", has_boleto: false, ...extra,
});

// ---- Reductions table ----

test("the reductions constant mirrors the API table", () => {
  assert.deepEqual(
    M.REDUCCIONES.map(r => [r.code, r.dobles, r.triples, r.apuestas]),
    [["R1", 0, 4, 9], ["R2", 7, 0, 16], ["R3", 3, 3, 24], ["R4", 6, 2, 64], ["R5", 0, 8, 81], ["R6", 11, 0, 132]],
  );
  assert.equal(M.reduccionOf("R4").apuestas, 64);
  assert.equal(M.reduccionOf("R9"), null);
  assert.equal(M.reduccionForFormat(3, 3).code, "R3");
  assert.equal(M.reduccionForFormat(1, 1), null);
  // Their cost at the 2026/27 price matches the product doc.
  assert.deepEqual(M.REDUCCIONES.map(r => L.costFor(r.apuestas, "0.75")), ["6.75", "12.00", "18.00", "48.00", "60.75", "99.00"]);
});

// ---- Parsing the new PorraOut shapes ----

test("PorraOut parses the four modes; old APIs without modo are múltiple", async () => {
  const sencilla = await gw(async () => json(porraWire())).get("2", "5");
  assert.deepEqual([sencilla.modo, sencilla.columnas, sencilla.fijos, sencilla.reduccion, sencilla.columns, sencilla.costEur], ["sencilla", 6, null, null, 6, "4.50"]);
  const intuicion = await gw(async () => json(porraWire({ modo: "intuicion", fijos: 10, columnas: 6 }))).get("2", "5");
  assert.deepEqual([intuicion.modo, intuicion.fijos, intuicion.columnas], ["intuicion", 10, 6]);
  const withCode = await gw(async () => json(porraWire({ modo: "reducida", columnas: null, dobles: 3, triples: 3, reduccion: "R3", columns: 24, cost_eur: "18.00" }))).get("2", "5");
  assert.deepEqual([withCode.modo, withCode.reduccion, withCode.columns], ["reducida", "R3", 24]);
  const derived = await gw(async () => json(porraWire({ modo: "reducida", columnas: null, dobles: 6, triples: 2, columns: 64, cost_eur: "48.00" }))).get("2", "5");
  assert.equal(derived.reduccion, "R4", "PorraOut has no reduccion today: the code comes from (dobles, triples)");
  const { modo, fijos, columnas, ...legacy } = porraWire({ dobles: 1, triples: 1 });
  void [modo, fijos, columnas];
  const old = await gw(async () => json(legacy)).get("2", "5");
  assert.deepEqual([old.modo, old.fijos, old.columnas, old.reduccion], ["multiple", null, null, null]);
  await rejectsCode(gw(async () => json(porraWire({ modo: "gratis" }))).get("2", "5"), "malformed");
  assert.deepEqual(V.porraTotals(sencilla), { columns: 6, costEur: "4.50" });
  assert.deepEqual(V.porraTotals({ ...sencilla, columns: 0, costEur: "" }), { columns: 6, costEur: "4.50" }, "derived from columnas when the API omits the totals");
  assert.deepEqual(V.porraTotals({ ...withCode, columns: 0, costEur: "" }), { columns: 24, costEur: "18.00" }, "a reducida plays the reduction's apuestas, not 2^D x 3^T");
});

test("the intuicion budget advisor options parse and sort most columns first", async () => {
  const { calls, fetcher } = capture({ budget_eur: "5.00", options: [
    { columnas: 4, fijos: 11, variables: 3, cost_eur: "3.00" }, { columnas: 6, fijos: 10, variables: 4, cost_eur: "4.50" }, { columnas: 2, fijos: 13, variables: 1, cost_eur: "1.50" },
  ] });
  const options = await A.listIntuicionOptions(gw(fetcher), "2", "5.00");
  assert.equal(calls[0].url, `${BASE}/groups/2/porras/intuicion-options?budget_eur=5.00`);
  assert.deepEqual(options[1], { columnas: 6, fijos: 10, variables: 4, costEur: "4.50" });
  assert.deepEqual(M.intuicionOptionsFor(options, "4.50").map(o => o.columnas), [6, 4, 2]);
  assert.deepEqual(M.intuicionOptionsFor(options, "3.00").map(o => o.columnas), [4, 2], "the 6-column option costs more than the budget");
  assert.equal(M.intuicionOptionLabel(options[1]), "6 columnas · 10 fijos · 4 variables · 4,50 €");
  await rejectsCode(A.listIntuicionOptions(gw(fetcher), "2", "0"), "invalid-porra");
});

// ---- Create and patch bodies per mode ----

test("the create body carries each mode's own fields and never the price", async () => {
  const bodies = [];
  const g = gw(async (_url, init) => { bodies.push(JSON.parse(init.body)); return json({ ...porraWire(), formats_preview: [], participation: null }, 201); });
  const specs = [
    { modo: "multiple", dobles: 1, triples: 1 },
    { modo: "sencilla", columnas: 6 },
    { modo: "reducida", reduccion: "R3" },
    { modo: "intuicion", fijos: 10, columnas: 6 },
  ];
  for (const spec of specs) await A.createPorra(g, "2", { jornadaId: "11", budgetEur: "6.00", spec });
  assert.deepEqual(bodies, [
    { jornada_id: 11, budget_eur: "6.00", modo: "multiple", dobles: 1, triples: 1 },
    { jornada_id: 11, budget_eur: "6.00", modo: "sencilla", columnas: 6 },
    { jornada_id: 11, budget_eur: "6.00", modo: "reducida", reduccion: "R3" },
    { jornada_id: 11, budget_eur: "6.00", modo: "intuicion", fijos: 10, columnas: 6 },
  ]);
  assert.ok(bodies.every(body => !("precio_apuesta_eur" in body)));
});

test("invalid specs never reach the API", async () => {
  const { calls, fetcher } = capture({});
  const g = gw(fetcher);
  for (const spec of [
    { modo: "multiple", dobles: 0, triples: 0 }, { modo: "multiple", dobles: 8, triples: 7 }, { modo: "sencilla", columnas: 1 }, { modo: "sencilla", columnas: 13 },
    { modo: "reducida", reduccion: "R7" }, { modo: "intuicion", fijos: 14, columnas: 6 }, { modo: "intuicion", fijos: 3, columnas: 1 }, { modo: "gratis" },
  ]) await rejectsCode(A.createPorra(g, "2", { jornadaId: "11", budgetEur: "6.00", spec }), "invalid-porra");
  assert.equal(calls.length, 0);
  assert.equal(M.isValidSpec({ modo: "sencilla", columnas: 2 }), true);
  assert.equal(M.isValidSpec({ modo: "intuicion", fijos: 13, columnas: 2 }), true);
  assert.equal(M.isValidSpec({ modo: "intuicion", fijos: 0, columnas: 12 }), true);
});

test("a patch can be budget-only, format-only or both", async () => {
  const bodies = [];
  const g = gw(async (_url, init) => { bodies.push(JSON.parse(init.body)); return json({ ...porraWire(), formats_preview: [], participation: null }); });
  await A.patchPorra(g, "2", "5", { budgetEur: "9.00" });
  await A.patchPorra(g, "2", "5", { spec: { modo: "reducida", reduccion: "R1" } });
  await A.patchPorra(g, "2", "5", { budgetEur: "9.00", spec: { modo: "sencilla", columnas: 8 } });
  assert.deepEqual(bodies, [{ budget_eur: "9.00" }, { modo: "reducida", reduccion: "R1" }, { budget_eur: "9.00", modo: "sencilla", columnas: 8 }]);
  await rejectsCode(A.patchPorra(g, "2", "5", { spec: { modo: "sencilla", columnas: 1 } }), "invalid-porra");
});

test("specs round trip through form fields, and budgetText seeds the input", () => {
  const fields = spec => { const f = M.specFields(spec); return M.specFromFields(name => f[name] ?? null); };
  for (const spec of [{ modo: "multiple", dobles: 2, triples: 1 }, { modo: "sencilla", columnas: 5 }, { modo: "reducida", reduccion: "R6" }, { modo: "intuicion", fijos: 8, columnas: 9 }]) {
    assert.deepEqual(fields(spec), spec);
  }
  assert.equal(M.specFromFields(name => ({ modo: "sencilla", columnas: "1" })[name] ?? null), null);
  assert.equal(M.specFromFields(name => ({ modo: "reducida" })[name] ?? null), null);
  assert.equal(M.specFromFields(() => null), null);
  assert.equal(L.budgetText("6.00"), "6");
  assert.equal(L.budgetText("6.50"), "6,50");
  assert.equal(L.budgetText("1234.05"), "1234,05");
  assert.equal(L.budgetText("abc"), "");
  assert.equal(L.parseBudget(L.budgetText("6.50")), "6.50");
});

test("the option lists per mode follow the budget and the price", () => {
  assert.deepEqual(M.sencillaOptions("4.50", "0.75"), [6, 5, 4, 3, 2].map(columnas => ({ columnas, costEur: L.costFor(columnas, "0.75") })));
  assert.equal(M.sencillaOptions("100.00", "0.75")[0].columnas, 12, "never more than 12 columns");
  assert.deepEqual(M.sencillaOptions("1.49", "0.75"), []);
  assert.equal(M.maxColumnas("9.00", "0.75"), 12);
  const reducidas = M.reduccionOptions("20.00", "0.75");
  assert.deepEqual(reducidas.map(r => [r.code, r.fits]), [["R1", true], ["R2", true], ["R3", true], ["R4", false], ["R5", false], ["R6", false]]);
  assert.equal(reducidas[2].costEur, "18.00");
  assert.equal(M.reduccionOptions("18.00", "0.75")[2].fits, true, "an exact budget fits");
});

// ---- PUT /boleto: new body and per-mode refusals ----

test("PUT /boleto sends columnas and never the legacy matches", async () => {
  const { calls, fetcher } = capture({ porra_id: 5, modo: "sencilla", set_at: "2026-10-05T10:00:00Z", set_by_user_id: 1, columnas: [{ matches: Array.from({ length: 14 }, (_, i) => ({ partido_orden: i + 1, signs: ["1"] })) }], pleno: { local: "1", visitante: "M" }, columns: 1, cost_eur: "0.75" });
  const draft = { columns: [Array.from({ length: 14 }, () => ["X"]), Array.from({ length: 14 }, () => ["2"])], pleno: { home: "1", away: "M" } };
  await A.saveFinalBoleto(gw(fetcher), "2", "5", draft);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(calls[0].init.method, "PUT");
  assert.equal("matches" in body, false);
  assert.equal(body.columnas.length, 2);
  assert.equal(body.columnas[1].matches.length, 14);
  assert.deepEqual(body.columnas[0].matches[0], { partido_orden: 1, signs: ["X"] });
  assert.deepEqual(body.pleno, { local: "1", visitante: "M" });
});

test("the per-mode PUT 422s read as clear Spanish copy", async () => {
  const put = detail => gw(async () => json({ detail }, 422)).putBoleto("2", "5", C.boletoInputFromColumns({ columns: [Array.from({ length: 14 }, () => ["1"])], pleno: { home: "0", away: "0" } })).catch(error => error);
  const dt = await put("column signs don't match D/T: expected 2 doubles + 1 triples, got 1 + 1");
  assert.equal(dt.code, "format-mismatch");
  assert.match(dt.message, /debe tener 2 dobles y 1 triple, y tiene 1 doble y 1 triple/);
  assert.match((await put("reduccion R3 requires 3 doubles + 3 triples, got 2 + 3")).message, /3 dobles y 3 triples/);
  assert.match((await put("sencilla mode requires exactly 6 columns, got 4")).message, /juega 6 columnas y el boleto tiene 4/);
  assert.match((await put("multiple mode requires exactly 1 column, got 2")).message, /juega 1 columna y el boleto tiene 2/);
  assert.match((await put("intuicion mode requires 6 columns, got 3")).message, /juega 6 columnas y el boleto tiene 3/);
  assert.match((await put("sencilla: every match must have exactly 1 sign, got 2 at partido 3")).message, /el partido 3 tiene 2/);
  assert.match((await put("intuicion: fijo partido 4 must have the same sign in all columns, got ['1', 'X']")).message, /El partido 4 es fijo/);
  assert.equal((await put("boleto costs 9.00€ (columns=12 × 0.75€), exceeds the budget 6.00€")).code, "over-budget");
  assert.equal((await put([{ loc: ["body", "columnas", 0], msg: "x" }])).code, "invalid-porra");
  assert.equal(boletoMismatch("something else"), undefined);
});

test("patching a format with a boleto saved is refused with boleto-locked", async () => {
  await rejectsCode(gw(async () => json({ detail: "new format (D=1, T=0) does not match the persisted boleto (D=1, T=1). Delete the boleto first (or POST /propuesta + PUT /boleto)." }, 422)).patch("2", "5", { spec: { modo: "multiple", dobles: 1, triples: 0 } }), "boleto-locked");
});

// ---- Delete boleto and the PDF ----

test("deleting the boleto calls DELETE and tolerates 204; 404 is not-found", async () => {
  const calls = [];
  const g = gw(async (url, init) => { calls.push({ url, method: init.method }); return new Response(null, { status: 204 }); });
  assert.equal(await A.removeBoleto(g, "2", "5"), undefined);
  assert.deepEqual(calls, [{ url: `${BASE}/groups/2/porras/5/boleto`, method: "DELETE" }]);
  await rejectsCode(A.removeBoleto(gw(async () => json({ detail: "no boleto saved yet" }, 404)), "2", "5"), "not-found");
  await rejectsCode(A.removeBoleto(gw(async () => json({ detail: "not admin" }, 403)), "2", "5"), "forbidden");
  await rejectsCode(A.removeBoleto(g, "x", "5"), "not-found");
});

test("the PDF is proxied with its type and disposition, and errors map by status", async () => {
  const seen = [];
  const pdf = new Response("%PDF-1.4 fake", { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="boleto-5.pdf"' } });
  const result = await A.loadBoletoPdf(gw(async (url, init) => { seen.push({ url, headers: init.headers }); return pdf; }), "2", "5");
  assert.equal(seen[0].url, `${BASE}/groups/2/porras/5/boleto.pdf`);
  assert.equal(seen[0].headers.Authorization, "Bearer tok");
  assert.equal(result.contentType, "application/pdf");
  assert.equal(result.contentDisposition, 'attachment; filename="boleto-5.pdf"');
  assert.equal(await new Response(result.body).text(), "%PDF-1.4 fake");
  const status = code => A.loadBoletoPdf(gw(async () => json({ detail: "x" }, code)), "2", "5");
  await rejectsCode(status(404), "not-found");
  await rejectsCode(status(403), "forbidden");
  await rejectsCode(status(401), "unauthenticated");
  await rejectsCode(status(500), "upstream");
  await rejectsCode(A.loadBoletoPdf(gw(async () => new Response("<html>", { status: 200, headers: { "Content-Type": "text/html" } })), "2", "5"), "malformed");
  await rejectsCode(A.loadBoletoPdf(gw(async () => { throw new Error("down"); }), "2", "5"), "network");
});

// ---- Per-mode boleto validation ----

const column = (sign = "1") => Array.from({ length: 14 }, () => [sign]);
const termsOf = (extra = {}) => ({ modo: "sencilla", columnas: 3, fijos: null, budgetEur: "6.00", precioApuestaEur: "0.75", ...extra });
const draftOf = (columns, pleno = { home: "1", away: "0" }) => ({ columns, pleno });

test("sencilla: N complete columns of one sign each", () => {
  const ok = C.checkColumns(draftOf([column("1"), column("X"), column("2")]), termsOf());
  assert.deepEqual([ok.canConfirm, ok.completeColumns, ok.totalColumns, ok.columns, ok.costEur, ok.over], [true, 3, 3, 3, "2.25", false]);
  const gap = column("1"); gap[4] = [];
  const missing = C.checkColumns(draftOf([column("1"), gap, gap.map(s => [...s])]), termsOf());
  assert.equal(missing.canConfirm, false);
  assert.equal(missing.completeColumns, 1);
  assert.deepEqual(missing.reasons, ["Faltan partidos por marcar en las columnas 2 y 3."]);
  const wrongCount = C.checkColumns(draftOf([column("1"), column("X")]), termsOf());
  assert.deepEqual(wrongCount.reasons, ["La porra juega 3 columnas y el boleto tiene 2."]);
  const multi = column("1"); multi[0] = ["1", "X"];
  assert.match(C.checkColumns(draftOf([column("1"), multi, column("2")]), termsOf()).reasons[0], /un solo signo.*columna 2, partido 1/);
  const noPleno = C.checkColumns(draftOf([column(), column(), column()], { home: null, away: "0" }), termsOf());
  assert.deepEqual(noPleno.reasons, ["Elige los goles de los dos equipos del pleno al 15."]);
  const over = C.checkColumns(draftOf([column(), column(), column()]), termsOf({ budgetEur: "2.00" }));
  assert.deepEqual(over.reasons, ["El boleto cuesta 2,25 € y el presupuesto es de 2,00 €."]);
  assert.equal(over.over, true);
});

test("intuicion: the first fijos partidos must agree in every column", () => {
  const terms = termsOf({ modo: "intuicion", fijos: 3, columnas: 2 });
  const a = column("1"); const b = column("1"); b[10] = ["X"];
  const ok = C.checkColumns(draftOf([a, b]), terms);
  assert.deepEqual([ok.canConfirm, ok.fijosMarked, ok.fijosTotal], [true, 3, 3]);
  const broken = column("1"); broken[1] = ["2"];
  const bad = C.checkColumns(draftOf([a, broken]), terms);
  assert.equal(bad.canConfirm, false);
  assert.deepEqual(bad.reasons, ["Los partidos fijos (2) deben llevar el mismo signo en todas las columnas."]);
  // A variable partido may differ, a fijo may not: partido 4 is not locked.
  const varies = column("1"); varies[3] = ["2"];
  assert.equal(C.checkColumns(draftOf([a, varies]), terms).canConfirm, true);
});

test("múltiple and reducida stay one column with exact dobles and triples; a reducida plays the reduction's apuestas", () => {
  const draft = (d, t) => {
    let draft = L.emptyDraft();
    for (let i = 1; i <= 14; i += 1) draft = L.toggleSign(draft, i, "1");
    for (let i = 1; i <= d; i += 1) draft = L.toggleSign(draft, i, "X");
    for (let i = d + 1; i <= d + t; i += 1) { draft = L.toggleSign(draft, i, "X"); draft = L.toggleSign(draft, i, "2"); }
    return L.setPleno(L.setPleno(draft, "home", "1"), "away", "M");
  };
  const reducida = { modo: "reducida", dobles: 3, triples: 3, columns: 24, budgetEur: "20.00", precioApuestaEur: "0.75" };
  const ok = L.editCheck(draft(3, 3), reducida);
  assert.deepEqual([ok.canConfirm, ok.columns, ok.formatColumns, ok.costEur], [true, 24, 24, "18.00"], "24 apuestas, not 2^3 x 3^3 = 216");
  const off = L.editCheck(draft(2, 3), reducida);
  assert.equal(off.canConfirm, false);
  assert.deepEqual(off.reasons, ["Te falta 1 doble por colocar."]);
  assert.deepEqual(off.overPlacement, []);
  const extra = L.editCheck(draft(4, 3), reducida);
  assert.deepEqual(extra.overPlacement, ["Te sobra 1 doble."], "over-placement is flagged on its own for the live warning");
  const multiple = L.editCheck(draft(1, 1), { dobles: 1, triples: 1, budgetEur: "6.00", precioApuestaEur: "0.75" });
  assert.deepEqual([multiple.canConfirm, multiple.columns, multiple.overPlacement], [true, 6, []]);
});

// ---- Intuición fijo mirroring ----

test("a fijo is edited once and mirrored to every column; variable rows stay per column", () => {
  const start = C.emptyColumnsDraft(3);
  const withFijo = C.setColumnSign(start, 1, 2, "X", 3);
  assert.deepEqual(withFijo.columns.map(rows => rows[1]), [["X"], ["X"], ["X"]]);
  const variable = C.setColumnSign(withFijo, 1, 8, "2", 3);
  assert.deepEqual(variable.columns.map(rows => rows[7]), [[], ["2"], []]);
  assert.deepEqual(start.columns[0][1], [], "pure: the previous draft is untouched");
  // Replaces the sign instead of toggling several.
  assert.deepEqual(C.setColumnSign(variable, 1, 8, "1", 3).columns[1][7], ["1"]);
  // Without fijos (sencilla) nothing is mirrored.
  assert.deepEqual(C.setColumnSign(start, 0, 2, "X").columns.map(rows => rows[1]), [["X"], [], []]);
  assert.equal(C.setColumnSign(start, 5, 2, "X"), start);
  assert.equal(C.setColumnSign(start, 0, 15, "X"), start);
  // Copy the previous column: variable rows only.
  const filled = C.setColumnSign(C.setColumnSign(C.setColumnSign(start, 0, 1, "1", 1), 0, 5, "2", 1), 1, 5, "X", 1);
  const copied = C.copyPreviousColumn(filled, 1, 1);
  assert.deepEqual(copied.columns[1][4], ["2"], "the variable rows copy column 1");
  assert.deepEqual(copied.columns[1][0], ["1"], "the fijos stay mirrored");
  const copiedFrom0 = C.copyPreviousColumn(C.setColumnSign(start, 0, 9, "2"), 1);
  assert.deepEqual(copiedFrom0.columns[1][8], ["2"]);
  assert.equal(C.copyPreviousColumn(start, 0), start);
});

test("fitColumns pads, trims and re-mirrors the fijos from column 1", () => {
  let draft = C.emptyColumnsDraft(2);
  draft = C.setColumnSign(draft, 0, 1, "1", 2);
  draft = C.setColumnSign(draft, 0, 6, "X", 2);
  const grown = C.fitColumns(draft, 4, 2);
  assert.equal(grown.columns.length, 4);
  assert.deepEqual(grown.columns[3][0], ["1"], "new columns inherit the fijos");
  assert.deepEqual(grown.columns[3][5], [], "but not the variable rows");
  assert.equal(C.fitColumns(grown, 2, 2).columns.length, 2);
  const skewed = { ...draft, columns: [draft.columns[0], draft.columns[1].map((signs, row) => (row === 0 ? ["2"] : signs))] };
  assert.deepEqual(C.fitColumns(skewed, 2, 2).columns[1][0], ["1"]);
});

test("isColumnsDraft guards what the server action receives", () => {
  assert.equal(C.isColumnsDraft(C.emptyColumnsDraft(2)), true);
  assert.equal(C.isColumnsDraft(C.emptyColumnsDraft(0)), false);
  assert.equal(C.isColumnsDraft(C.emptyColumnsDraft(13)), false);
  assert.equal(C.isColumnsDraft({ columns: [column().slice(1)], pleno: { home: null, away: null } }), false);
  assert.equal(C.isColumnsDraft({ columns: [column("9")], pleno: { home: null, away: null } }), false);
  assert.equal(C.isColumnsDraft({ columns: [column()], pleno: { home: "7", away: null } }), false);
  assert.equal(C.boletoInputFromColumns(C.emptyColumnsDraft(2)), null);
  const input = C.boletoInputFromColumns(draftOf([column("X"), column("2")]));
  assert.equal(input.columnas.length, 2);
  assert.deepEqual(input.columnas[1][13], { position: 14, signs: ["2"] });
});

// ---- Propuesta: one proposal per column ----

const partidoWire = (order, counts, reparto) => ({ partido_orden: order, vote_counts: counts, reparto, kind: reparto.length === 1 ? "simple" : reparto.length === 2 ? "doble" : "triple" });
/** One column of 14 partidos: `pick(order)` gives that row's [counts, reparto]. */
const columnaWire = (idx, pick = () => [{ "1": 3, X: 1, "2": 0 }, ["1"]]) => ({
  columna_idx: idx, partidos: Array.from({ length: 14 }, (_, i) => partidoWire(i + 1, ...pick(i + 1))),
});
const participationWire = { voted: 2, total_members: 3, missing_voters: [] };
const propuestaWire = (columnas, extra = {}) => ({
  porra_id: 5, modo: "sencilla", fijos: null, columnas, pleno: { local: "M", visitante: "2" }, participation: participationWire, columns: columnas.length, cost_eur: "3.00", ...extra,
});

test("propuesta parses the new per-column shape: one column for múltiple, N for sencilla and Intuición", async () => {
  const one = await gw(async () => json(propuestaWire([columnaWire(1, order => [{ "1": 1.5, X: 0.5, "2": 0 }, order === 1 ? ["X", "1"] : ["1"]])], { modo: "multiple", columns: 6, cost_eur: "4.50" }))).propuesta("2", "5");
  assert.equal(one.columnas.length, 1);
  assert.equal(one.modo, "multiple");
  assert.deepEqual(one.matches[0].signs, ["1", "X"], "rows of the first column, sorted 1 X 2");
  assert.equal(one.matches[0].kind, "doble");
  assert.equal(one.matches[0].weights["1"], 1.5);
  assert.deepEqual(one.pleno, { home: "M", away: "2" });
  assert.deepEqual([one.columns, one.costEur], [6, "4.50"]);
  assert.equal(one.participation.voted, 2);

  const many = await gw(async () => json(propuestaWire([columnaWire(2, () => [{ "1": 0, X: 0, "2": 4 }, ["2"]]), columnaWire(1), columnaWire(3, () => [{ "1": 0, X: 2, "2": 0 }, ["X"]])], { modo: "intuicion", fijos: 10 }))).propuesta("2", "5");
  assert.deepEqual(many.columnas.map(column => column.index), [1, 2, 3], "ordered by columna_idx");
  assert.deepEqual(many.columnas[1].matches[0].signs, ["2"]);
  assert.equal(many.fijos, 10);
  assert.equal(many.matches, many.columnas[0].matches);
  assert.equal("plenoCounts" in many, false);
});

test("propuesta refuses a body that is not the new shape", async () => {
  const old = Array.from({ length: 14 }, (_, i) => partidoWire(i + 1, { "1": 1, X: 0, "2": 0 }, ["1"]));
  await rejectsCode(gw(async () => json({ porra_id: 5, dobles: 0, triples: 0, columns: 1, cost_eur: "0.75", partidos: old, participation: participationWire })).propuesta("2", "5"), "malformed");
  await rejectsCode(gw(async () => json(propuestaWire([]))).propuesta("2", "5"), "malformed");
  await rejectsCode(gw(async () => json(propuestaWire([{ columna_idx: 1, partidos: columnaWire(1).partidos.slice(1) }]))).propuesta("2", "5"), "malformed");
  await rejectsCode(gw(async () => json(propuestaWire([columnaWire(1, () => [{ "1": 1 }, ["1"]])]))).propuesta("2", "5"), "malformed");
  await rejectsCode(gw(async () => json(propuestaWire([columnaWire(1)], { pleno: { local: "9", visitante: "2" } }))).propuesta("2", "5"), "malformed");
});

test("the editor is seeded straight from each column of the proposal", async () => {
  const wire = propuestaWire([
    columnaWire(1, order => [{ "1": 3, X: 1, "2": 0 }, [order <= 10 ? "1" : "X"]]),
    columnaWire(2, order => [{ "1": 3, X: 1, "2": 0 }, [order <= 10 ? "1" : "2"]]),
    columnaWire(3, order => [{ "1": 3, X: 1, "2": 0 }, [order <= 10 ? "1" : "1"]]),
  ], { modo: "intuicion", fijos: 10 });
  const propuesta = await gw(async () => json(wire)).propuesta("2", "5");
  const seed = C.columnsDraftFromPropuesta(propuesta, { modo: "intuicion", fijos: 10, columnas: 3 });
  assert.equal(seed.columns.length, 3);
  assert.deepEqual(seed.columns.map(rows => rows[13][0]), ["X", "2", "1"], "each column keeps its own reparto");
  assert.deepEqual(seed.columns[1][0], ["1"]);
  assert.deepEqual(seed.pleno, { home: "M", away: "2" });
  assert.equal(C.checkColumns(seed, termsOf({ modo: "intuicion", fijos: 10, columnas: 3, budgetEur: "6.00" })).canConfirm, true);

  // Fewer proposal columns than the porra plays: the missing ones start from a copy of the first (fijos mirrored).
  const short = C.columnsDraftFromPropuesta(propuesta, { modo: "sencilla", columnas: 5 });
  assert.equal(short.columns.length, 5);
  // A repartos with several signs in a one-sign mode keeps the most voted.
  const multi = { ...propuesta, columnas: [{ index: 1, matches: propuesta.columnas[0].matches.map(match => ({ ...match, signs: ["1", "X"], weights: { "1": 1, X: 2, "2": 0 } })) }] };
  assert.deepEqual(C.columnsDraftFromPropuesta(multi, { modo: "sencilla", columnas: 1 }).columns[0][0], ["X"]);
});

test("múltiple and reducida seed one column with the proposal's own dobles and triples", async () => {
  const wire = propuestaWire([columnaWire(1, order => [{ "1": 5, X: 4, "2": 0 }, order <= 2 ? ["1", "X"] : ["1"]])], { modo: "multiple" });
  const propuesta = await gw(async () => json(wire)).propuesta("2", "5");
  for (const spec of [{ modo: "multiple", dobles: 2, triples: 0 }, { modo: "reducida", reduccion: "R2" }]) {
    const seed = C.columnsDraftFromPropuesta(propuesta, spec);
    assert.equal(seed.columns.length, 1);
    assert.deepEqual(seed.columns[0][0], ["1", "X"]);
    assert.deepEqual(seed.columns[0][2], ["1"]);
  }
  assert.deepEqual(L.draftFromPropuesta(propuesta).picks[0], ["1", "X"]);
});

// ---- The member's vote: N columns ----

const voteDraft = (columns, pleno = { home: "1", away: "0" }) => ({ columns, pleno });
const rowsOf = (...signs) => Array.from({ length: 14 }, (_, i) => [signs[i] ?? "1"]);

test("wireVote sends columnas for every mode and never the rejected picks key", async () => {
  const send = async (draft, rules) => {
    const { fetcher, calls } = capture({ porra_id: 5, show_picks: false, members: [] });
    await A.submitVote(gw(fetcher), "2", "5", draft, rules);
    return JSON.parse(calls[0].init.body);
  };
  // múltiple / reducida: one column with 1 to 3 free signs.
  const free = voteDraft([Array.from({ length: 14 }, (_, i) => (i === 2 ? ["1", "X"] : ["2"]))]);
  const multiple = await send(free, C.voteRulesOf({ modo: "multiple", columnas: null, fijos: null }));
  assert.equal("picks" in multiple, false);
  assert.equal(multiple.columnas.length, 1);
  assert.equal(multiple.columnas[0].matches.length, 14);
  assert.deepEqual(multiple.columnas[0].matches[2], { partido_orden: 3, signs: ["1", "X"] });
  assert.deepEqual(multiple.pleno, { local: "1", visitante: "0" });
  assert.equal((await send(free, C.voteRulesOf({ modo: "reducida", columnas: null, fijos: null }))).columnas.length, 1);
  // sencilla: exactly N columns, one sign per row.
  const sencilla = await send(voteDraft([rowsOf("1"), rowsOf("X"), rowsOf("2")]), C.voteRulesOf({ modo: "sencilla", columnas: 3, fijos: null }));
  assert.equal(sencilla.columnas.length, 3);
  assert.deepEqual(sencilla.columnas.map(column => column.matches[0].signs), [["1"], ["X"], ["2"]]);
  assert.ok(sencilla.columnas.every(column => column.matches.every(match => match.signs.length === 1)));
  // intuicion: same, with the first F rows identical everywhere.
  const columns = [rowsOf("1", "1", "1", "X"), rowsOf("1", "1", "1", "2")];
  const intuicion = await send(voteDraft(columns), C.voteRulesOf({ modo: "intuicion", columnas: 2, fijos: 3 }));
  assert.equal(intuicion.columnas.length, 2);
  assert.deepEqual(intuicion.columnas.map(column => column.matches[3].signs), [["X"], ["2"]]);
});

test("a multi-column vote is checked before it reaches the API", async () => {
  const sencilla = C.voteRulesOf({ modo: "sencilla", columnas: 3, fijos: null });
  const intuicion = C.voteRulesOf({ modo: "intuicion", columnas: 2, fijos: 3 });
  assert.deepEqual(C.validateColumnsVote(voteDraft([rowsOf(), rowsOf(), rowsOf()]), sencilla), {});
  // wrong number of columns
  const wrongCount = C.validateColumnsVote(voteDraft([rowsOf(), rowsOf()]), sencilla);
  assert.match(wrongCount.columnas, /La porra juega 3 columnas y el boleto tiene 2/);
  // an unmarked row names the column
  const gap = rowsOf(); gap[4] = [];
  assert.equal(C.validateColumnsVote(voteDraft([rowsOf(), gap, rowsOf()]), sencilla)["pick-5"], "Partido 5: marca un signo en la columna 2.");
  assert.match(C.validateColumnsVote(voteDraft([gap, gap, rowsOf()]), sencilla)["pick-5"], /las columnas 1 y 2/);
  // more than one sign
  const doble = rowsOf(); doble[1] = ["1", "X"];
  assert.match(C.validateColumnsVote(voteDraft([rowsOf(), rowsOf(), doble]), sencilla)["pick-2"], /solo un signo por columna \(revisa la columna 3\)/);
  // fijo mismatch (Intuición only)
  const skew = voteDraft([rowsOf("1", "1", "1"), rowsOf("1", "X", "1")]);
  assert.match(C.validateColumnsVote(skew, intuicion)["pick-2"], /Partido 2: es fijo y debe llevar el mismo signo en todas las columnas/);
  assert.equal(C.validateColumnsVote(skew, { ...intuicion, fijos: 1 })["pick-2"], undefined, "row 2 is variable with one fijo");
  // the pleno is required
  assert.ok(C.validateColumnsVote({ columns: [rowsOf(), rowsOf(), rowsOf()], pleno: { home: null, away: "1" } }, sencilla)["pleno-home"]);
  // single column rules keep 1 to 3 free signs
  assert.deepEqual(C.validateColumnsVote(voteDraft([Array.from({ length: 14 }, () => ["1", "X", "2"])]), C.voteRulesOf({ modo: "multiple" })), {});
  assert.equal(C.voteFromColumns(skew, intuicion), null);
  let called = false;
  await assert.rejects(A.submitVote(gw(async () => { called = true; return json({}); }), "2", "5", skew, intuicion), e => e instanceof A.VoteValidationError && Boolean(e.fields["pick-2"]));
  assert.equal(called, false);
});

test("the vote caption explains the columns and the fijos", () => {
  assert.equal(C.voteCaption(C.voteRulesOf({ modo: "multiple" })), undefined);
  assert.equal(C.voteCaption(C.voteRulesOf({ modo: "sencilla", columnas: 4 })), "Rellena las 4 columnas: un signo por partido en cada una");
  assert.equal(
    C.voteCaption(C.voteRulesOf({ modo: "intuicion", columnas: 4, fijos: 10 })),
    "Rellena las 4 columnas: un signo por partido en cada una. Los primeros 10 partidos son fijos: el mismo signo en todas las columnas",
  );
});

test("a saved vote becomes a draft with exactly the porra's columns", () => {
  const rules = C.voteRulesOf({ modo: "intuicion", columnas: 3, fijos: 2 });
  assert.equal(C.columnsDraftFromSheet(null, rules).columns.length, 3);
  const sheet = { picks: [], columnas: [[{ position: 1, signs: ["X"] }, { position: 3, signs: ["2"] }]], pleno: { home: "1", away: "M" }, matches: [] };
  const draft = C.columnsDraftFromSheet(sheet, rules);
  assert.equal(draft.columns.length, 3);
  assert.deepEqual(draft.columns[2][0], ["X"], "the fijos of column 1 are mirrored");
  assert.deepEqual(draft.columns[2][2], [], "the variable rows are not");
  assert.deepEqual(draft.pleno, { home: "1", away: "M" });
  assert.deepEqual(C.columnsProgress(draft), { completeColumns: 0, totalColumns: 3, marked: 2, plenoDone: true });
});

test("a draft stored in the session round-trips only against the same baseline", () => {
  const base = C.emptyColumnsDraft(2);
  const draft = C.setColumnSign(base, 1, 4, "X");
  assert.deepEqual(C.decodeColumnsDraft(C.encodeColumnsDraft(base, draft), base), draft);
  assert.equal(C.decodeColumnsDraft(C.encodeColumnsDraft(base, draft), draft), null);
  assert.equal(C.decodeColumnsDraft("{oops", base), null);
});

test("the pick 422s read as clear Spanish copy and flag the rows under columnas", async () => {
  const vote = voteDraft([rowsOf(), rowsOf()]);
  const rules = C.voteRulesOf({ modo: "sencilla", columnas: 2, fijos: null });
  const refuse = detail => A.submitVote(gw(async () => json({ detail }, 422)), "2", "5", vote, rules).catch(error => error);
  const count = await refuse("modo='sencilla' requires exactly 4 column(s), got 2");
  assert.equal(count.code, "format-mismatch");
  assert.match(count.message, /juega 4 columnas y el boleto tiene 2/);
  assert.match((await refuse("sencilla: every match must have exactly 1 sign, got 2 at partido 3 (column 2)")).message, /el partido 3 tiene 2 en la columna 2/);
  assert.match((await refuse("intuicion: fijo partido 4 must have the same sign in all columns, got ['1', 'X']")).message, /El partido 4 es fijo/);
  const flagged = await refuse([{ loc: ["body", "columnas", 1, "matches", 2, "signs"], msg: "x" }, { loc: ["body", "pleno", "local"], msg: "y" }]);
  assert.equal(flagged.code, "invalid-picks");
  assert.deepEqual(flagged.invalidMatches, [3, 15]);
});

// ---- Reading the picks: N columns ----

const pickRow = (order, signs, extra = {}) => ({ partido_orden: order, signs, pleno_local: null, pleno_visitante: null, local_team_id: 1, visitante_team_id: 2, ...extra });
const plenoRow = (extra = {}) => ({ partido_orden: 15, signs: null, pleno_local: "2", pleno_visitante: "M", local_team_id: 1, visitante_team_id: 2, ...extra });

test("picks with columna_idx are grouped by it", async () => {
  const rows = [
    pickRow(1, ["2"], { columna_idx: 2 }), pickRow(1, ["1"], { columna_idx: 1 }), pickRow(2, ["X"], { columna_idx: 2 }), pickRow(2, ["X"], { columna_idx: 1 }),
    plenoRow({ columna_idx: 1 }), plenoRow({ columna_idx: 2 }),
  ];
  const sheet = await gw(async () => json(rows)).myPicks("2", "5");
  assert.equal(sheet.columnas.length, 2);
  assert.deepEqual(sheet.columnas[0], [{ position: 1, signs: ["1"] }, { position: 2, signs: ["X"] }]);
  assert.deepEqual(sheet.columnas[1], [{ position: 1, signs: ["2"] }, { position: 2, signs: ["X"] }]);
  assert.deepEqual(sheet.picks, sheet.columnas[0]);
  assert.deepEqual(sheet.pleno, { home: "2", away: "M" });
});

test("picks without columna_idx: duplicate partidos fall back to order of appearance, and the pleno is deduplicated", async () => {
  // The API repeats every partido once per column and does not say which column a row belongs to (yet).
  const rows = [
    pickRow(1, ["1"]), pickRow(1, ["X"]), pickRow(1, ["2"]), pickRow(2, ["2"]), pickRow(2, ["2"]), pickRow(2, ["1"]),
    plenoRow(), plenoRow(), plenoRow(),
  ];
  const sheet = await gw(async () => json(rows)).myPicks("2", "5");
  assert.equal(sheet.columnas.length, 3);
  assert.deepEqual(sheet.columnas.map(column => column[0].signs), [["1"], ["X"], ["2"]], "1st occurrence is column 1, and so on");
  assert.deepEqual(sheet.columnas.map(column => column[1].signs), [["2"], ["2"], ["1"]]);
  assert.deepEqual(sheet.pleno, { home: "2", away: "M" });
  assert.equal(sheet.matches.length, 3, "one team entry per partido, not per row");
  // A single-column vote is still one column.
  const single = await gw(async () => json([pickRow(1, ["X", "1"]), pickRow(2, ["2"]), plenoRow()])).myPicks("2", "5");
  assert.equal(single.columnas.length, 1);
  assert.deepEqual(single.picks, [{ position: 1, signs: ["1", "X"] }, { position: 2, signs: ["2"] }]);
});

test("the admin's members view carries every column of each member", async () => {
  const rows = [pickRow(1, ["1"], { columna_idx: 1 }), pickRow(1, ["2"], { columna_idx: 2 }), plenoRow({ columna_idx: 1 })];
  const view = await gw(async () => json({ porra_id: 5, show_picks: true, members: [{ user_id: 7, display_name: "Ana", voted: true, picks: rows }, { user_id: 8, display_name: "Leo", voted: false, picks: null }] })).listPicks("2", "5");
  assert.equal(view.members[0].sheet.columnas.length, 2);
  assert.equal(view.members[1].sheet, null);
});
