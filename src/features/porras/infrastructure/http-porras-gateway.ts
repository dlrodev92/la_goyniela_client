import "server-only";
import { z } from "zod";
import type {
  Boleto, BoletoInput, BoletoPdf, IntuicionOption, MatchTeams, MemberPicks, Participation, Pick, PicksSheet, PicksView, Pleno,
  Porra, PorraDetail, PorraFormat, PorraSpec, PorrasGateway, PorraStatus, Propuesta, PropuestaColumn, PropuestaMatch, ReduccionCode, Sign, TeamRef, Vote,
} from "../domain/porras";
import { sortSigns } from "../domain/logic";
import { normalizeFijos, reduccionForFormat } from "../domain/modes";
import { createAuthenticatedClient } from "../../../lib/http/json-client";
import { ServiceError, type FailureCode } from "../../../lib/http/errors";
import { windowConflict, windowFailureCode, type WindowContext } from "../../../lib/http/window-conflict";
import { fullNameOf, logoUrlOf, shortNameOf, teamRefSchema } from "../../../lib/http/team-wire";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.string().datetime({ offset: true });
/** Pydantic serialises Decimal as a string; a number is tolerated and stringified. Never parsed to float for math. */
const money = z.union([z.string().regex(/^\d+(\.\d+)?$/), z.number().nonnegative()]).transform(String);
const sign = z.enum(["1", "X", "2"]);
const goals = z.enum(["0", "1", "2", "M"]);
const count = z.number().int().nonnegative();
/** Intuición fijos: the legacy count N (partidos 1..N) or the list of locked partidos. Both read as the list. */
const fijos = z.union([z.number().int().min(0).max(14), z.array(z.number().int().min(1).max(14)).max(14)]);

const formatSchema = z.object({ dobles: count, triples: count, columns: count, coste_eur: money });
const missingSchema = z.object({ user_id: id, display_name: z.string() });
const participationSchema = z.object({ voted: count, total_members: count, missing_voters: z.array(missingSchema).default([]) });
const modo = z.enum(["multiple", "sencilla", "reducida", "intuicion"]);
const reduccionCode = z.enum(["R1", "R2", "R3", "R4", "R5", "R6"]);
const porraSchema = z.object({
  id, group_id: id, jornada_id: id, created_by_user_id: id, budget_eur: money, dobles: count, triples: count,
  /** Older builds have no `modo`: they are all múltiple. */
  modo: modo.default("multiple"),
  fijos: fijos.nullable().optional(),
  columnas: count.nullable().optional(),
  /** `PorraOut` does not carry the code today (only `BoletoOut` does): optional, derived from (dobles, triples) when absent. */
  reduccion: reduccionCode.nullable().optional(),
  precio_apuesta_eur: money, status: z.string().transform((value): PorraStatus => (value === "open" || value === "closed" ? value : "unknown")), created_at: timestamp, updated_at: timestamp,
  columns: count, cost_eur: money, has_boleto: z.boolean(),
});
const porraDetailSchema = porraSchema.extend({
  formats_preview: z.array(formatSchema).default([]),
  participation: participationSchema.nullable().optional(),
});
const pickOutSchema = z.object({
  partido_orden: z.number().int().min(1).max(15),
  /** 1-indexed column this pick belongs to (backend guarantee post multi-column sprint). Required. */
  columna_idx: z.number().int().min(1),
  signs: z.array(sign).nullable().optional(),
  pleno_local: goals.nullable().optional(),
  pleno_visitante: goals.nullable().optional(),
  local_team: teamRefSchema.nullable().optional(),
  visitante_team: teamRefSchema.nullable().optional(),
});
const picksOutSchema = z.object({
  porra_id: id, show_picks: z.boolean(),
  members: z.array(z.object({
    user_id: id, display_name: z.string(), voted: z.boolean(),
    voted_at: timestamp.nullable().optional(), picks: z.array(pickOutSchema).nullable().optional(),
  })),
});
const propuestaPartidoSchema = z.object({
  partido_orden: z.number().int().min(1).max(14),
  vote_counts: z.record(z.string(), z.unknown()),
  reparto: z.array(sign),
  kind: z.string(),
});
const propuestaSchema = z.object({
  porra_id: id, modo: modo.default("multiple"), fijos: fijos.nullable().optional(), columns: count, cost_eur: money,
  /** One entry for múltiple and reducida, N (`columna_idx` 1-based) for sencilla and Intuición; each one is its own proposal. */
  columnas: z.array(z.object({ columna_idx: z.number().int().min(1), partidos: z.array(propuestaPartidoSchema) })).min(1),
  /** The Pleno al 15 is shared by every column, so it is a sibling of `columnas`. */
  pleno: z.object({ local: goals, visitante: goals }),
  participation: participationSchema,
});
const boletoMatchSchema = z.object({ partido_orden: z.number().int().min(1).max(14), signs: z.array(sign).min(1).max(3) });
const boletoSchema = z.object({
  porra_id: id, modo: modo.default("multiple"), set_at: timestamp, set_by_user_id: id.nullable(),
  /** The printed columns: 1 for múltiple and reducida, N for sencilla and Intuición. */
  columnas: z.array(z.object({ matches: z.array(boletoMatchSchema).length(14) })).min(1),
  pleno: z.object({ local: goals, visitante: goals }),
  columns: count, cost_eur: money, reduccion: reduccionCode.nullable().optional(),
});
const intuicionOptionsSchema = z.object({
  budget_eur: money,
  options: z.array(z.object({ columnas: count, fijos: count, variables: count, cost_eur: money })).default([]),
});

const toFormat = (w: z.infer<typeof formatSchema>): PorraFormat => ({ dobles: w.dobles, triples: w.triples, columns: w.columns, costEur: w.coste_eur });
const toParticipation = (w: z.infer<typeof participationSchema>): Participation => ({
  voted: w.voted, totalMembers: w.total_members,
  missingVoters: w.missing_voters.map(m => ({ userId: String(m.user_id), displayName: m.display_name })),
});
function toPorra(w: z.infer<typeof porraSchema>): Porra {
  const reduccion: ReduccionCode | null = w.modo === "reducida" ? w.reduccion ?? reduccionForFormat(w.dobles, w.triples)?.code ?? null : null;
  return {
    id: String(w.id), groupId: String(w.group_id), jornadaId: String(w.jornada_id), createdByUserId: String(w.created_by_user_id),
    budgetEur: w.budget_eur, modo: w.modo, dobles: w.dobles, triples: w.triples, fijos: w.fijos == null ? null : normalizeFijos(w.fijos), columnas: w.columnas ?? null, reduccion,
    precioApuestaEur: w.precio_apuesta_eur, status: w.status,
    createdAt: w.created_at, updatedAt: w.updated_at, columns: w.columns, costEur: w.cost_eur, hasBoleto: w.has_boleto,
  };
}
const toDetail = (w: z.infer<typeof porraDetailSchema>): PorraDetail => ({
  ...toPorra(w), formatsPreview: w.formats_preview.map(toFormat), participation: w.participation ? toParticipation(w.participation) : null,
});
function toTeam(team: z.infer<typeof teamRefSchema> | null | undefined): TeamRef | null {
  const name = fullNameOf(team);
  return name ? { name, shortName: shortNameOf(team), logoUrl: logoUrlOf(team) } : null;
}
/**
 * Rows of one member -> the sheet. `columna_idx` (a stable backend guarantee) groups rows by column; the
 * pleno appears once per column with the same value and we keep only the first non-empty one.
 */
function toSheet(rows: z.infer<typeof pickOutSchema>[]): PicksSheet {
  const byColumn = new Map<number, Pick[]>();
  let pleno: Pleno | null = null;
  const matches = new Map<number, MatchTeams>();
  for (const row of [...rows].sort(
    (a, b) => a.columna_idx - b.columna_idx || a.partido_orden - b.partido_orden,
  )) {
    if (!matches.has(row.partido_orden)) matches.set(row.partido_orden, { position: row.partido_orden, home: toTeam(row.local_team), away: toTeam(row.visitante_team) });
    if (row.partido_orden === 15) {
      if (!pleno && row.pleno_local && row.pleno_visitante) pleno = { home: row.pleno_local, away: row.pleno_visitante };
      continue;
    }
    if (!row.signs || row.signs.length === 0) continue;
    byColumn.set(row.columna_idx, [
      ...(byColumn.get(row.columna_idx) ?? []),
      { position: row.partido_orden, signs: sortSigns(row.signs) },
    ]);
  }
  const columnas = [...byColumn.entries()].sort(([a], [b]) => a - b).map(([, picks]) => picks);
  return { picks: columnas[0] ?? [], columnas, pleno, matches: [...matches.values()] };
}
const toPicksView = (w: z.infer<typeof picksOutSchema>): PicksView => ({
  porraId: String(w.porra_id), showPicks: w.show_picks,
  members: w.members.map((m): MemberPicks => ({
    userId: String(m.user_id), displayName: m.display_name, voted: m.voted, votedAt: m.voted_at ?? null,
    sheet: m.picks ? toSheet(m.picks) : null,
  })),
});
function toBoleto(w: z.infer<typeof boletoSchema>): Boleto {
  return {
    porraId: String(w.porra_id), modo: w.modo, setAt: w.set_at, setByUserId: w.set_by_user_id === null ? null : String(w.set_by_user_id),
    columnas: w.columnas.map(column => column.matches.map(m => ({ position: m.partido_orden, signs: sortSigns(m.signs) })).sort((a, b) => a.position - b.position)),
    pleno: { home: w.pleno.local, away: w.pleno.visitante }, columns: w.columns, costEur: w.cost_eur,
    reduccion: w.modo === "reducida" ? w.reduccion ?? null : null,
  };
}
const toIntuicionOption = (w: z.infer<typeof intuicionOptionsSchema>["options"][number]): IntuicionOption =>
  ({ columnas: w.columnas, fijos: w.fijos, variables: w.variables, costEur: w.cost_eur });

const malformed = () => new ServiceError("malformed");
function readWeights(raw: unknown): Record<Sign, number> {
  const parsed = z.object({ "1": z.number(), X: z.number(), "2": z.number() }).safeParse(raw);
  if (!parsed.success) throw malformed();
  return parsed.data;
}
function toPropuestaColumn(w: z.infer<typeof propuestaSchema>["columnas"][number]): PropuestaColumn {
  const matches: PropuestaMatch[] = w.partidos.map((item): PropuestaMatch => {
    const kind = item.kind;
    if (kind !== "simple" && kind !== "doble" && kind !== "triple") throw malformed();
    return { position: item.partido_orden, weights: readWeights(item.vote_counts), signs: sortSigns(item.reparto), kind };
  }).sort((a, b) => a.position - b.position);
  if (matches.length !== 14 || matches.some((match, index) => match.position !== index + 1)) throw malformed();
  return { index: w.columna_idx, matches };
}
function toPropuesta(w: z.infer<typeof propuestaSchema>): Propuesta {
  const columnas = w.columnas.map(toPropuestaColumn).sort((a, b) => a.index - b.index);
  return {
    porraId: String(w.porra_id), modo: w.modo, fijos: w.fijos == null ? null : normalizeFijos(w.fijos), columns: w.columns, costEur: w.cost_eur,
    columnas, matches: columnas[0].matches,
    pleno: { home: w.pleno.local, away: w.pleno.visitante },
    participation: toParticipation(w.participation),
  };
}

/** Pydantic 422 `loc` paths -> 1-based match numbers (15 = pleno) the backend flagged. The messages are never shown. */
function invalidRows(detail: unknown): number[] {
  if (!Array.isArray(detail)) return [];
  const rows = new Set<number>();
  for (const item of detail) {
    const loc = (item as { loc?: unknown } | null)?.loc;
    if (!Array.isArray(loc)) continue;
    // Rows live under `columnas[c].matches[r]` (the legacy alias `matches[r]` and the old `picks[r]` are read too).
    const at = loc.lastIndexOf("matches") >= 0 ? loc.lastIndexOf("matches") : loc.indexOf("picks");
    const index = loc[at + 1];
    if (at >= 0 && typeof index === "number") rows.add(index + 1);
    else if (loc.includes("pleno")) rows.add(15);
  }
  return [...rows].sort((a, b) => a - b);
}

/** Readable text of a 422 detail: the string itself, or the Pydantic `msg`s of an array. Used to match rules, never shown. */
function detailText(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return "";
  return detail.map(item => (typeof (item as { msg?: unknown } | null)?.msg === "string" ? (item as { msg: string }).msg : "")).join(" ");
}

const KIND_WORDS: Record<string, string> = { dobles: "dobles", triples: "triples", simples: "simples" };

const plural = (count: string, one: string, many: string) => `${count} ${count === "1" ? one : many}`;

/**
 * Spanish copy for the per-mode PUT /boleto refusals (the API's wording is English and never shown). Undefined for
 * anything else, so the caller keeps its own fallback.
 */
export function boletoMismatch(text: string): string | undefined {
  // multiple: "column signs don't match D/T: expected 2 doubles + 1 triples, got 1 + 1"; reducida: "reduccion R3 requires 3 doubles + 3 triples, got 2 + 3"
  const counts = /(?:expected|requires) (\d+) doubles \+ (\d+) triples, got (\d+) \+ (\d+)/.exec(text);
  if (counts) {
    const [, d, t, gd, gt] = counts;
    return `El boleto debe tener ${plural(d, "doble", "dobles")} y ${plural(t, "triple", "triples")}, y tiene ${plural(gd, "doble", "dobles")} y ${plural(gt, "triple", "triples")}. Ajusta los signos para respetar el formato de la porra.`;
  }
  // "modo='sencilla' requires exactly 4 column(s), got 2"
  const columns = /requires (?:exactly )?(\d+) columns?(?:\(s\))?, got (\d+)/.exec(text);
  if (columns) return `La porra juega ${plural(columns[1], "columna", "columnas")} y el boleto tiene ${columns[2]}. Ajusta las columnas del boleto.`;
  // "sencilla: every match must have exactly 1 sign, got 2 at partido 3 (column 2)"
  const single = /every match must have exactly 1 sign, got (\d+) at partido (\d+)(?: \(column (\d+)\))?/.exec(text);
  if (single) return `En este modo cada partido lleva un solo signo: el partido ${single[2]} tiene ${single[1]}${single[3] ? ` en la columna ${single[3]}` : ""}.`;
  const fijo = /fijo partido (\d+) must have the same sign in all columns/.exec(text);
  if (fijo) return `El partido ${fijo[1]} es fijo y debe llevar el mismo signo en todas las columnas.`;
  return undefined;
}

/** The backend sends 422 details as strings for business rules and as arrays for schema errors. Text is never shown. */
function classify422(fallback: FailureCode) {
  return (detail: unknown): ServiceError => {
    const text = detailText(detail);
    if (text.includes("minimum format")) return new ServiceError("min-format");
    if (text.includes("persisted boleto")) return new ServiceError("boleto-locked");
    const expected = /^expected (\d+) (dobles|triples|simples) in the boleto, got (\d+)/.exec(text);
    if (expected) {
      const [, want, kind, got] = expected;
      return new ServiceError("format-mismatch", { message: `El boleto debe tener ${want} ${KIND_WORDS[kind]} y tiene ${got}. Ajusta los signos para respetar el formato de la porra.` });
    }
    const mismatch = boletoMismatch(text);
    if (mismatch) return new ServiceError("format-mismatch", { message: mismatch });
    if (/^boleto costs .*exceeds the budget/.test(text)) return new ServiceError("over-budget", { message: "El boleto cuesta más que el presupuesto de la porra." });
    if (text.includes("exceeds the budget")) return new ServiceError("over-budget");
    return new ServiceError(fallback, fallback === "invalid-picks" ? { invalidMatches: invalidRows(detail) } : {});
  };
}

const lower = (detail: unknown) => (typeof detail === "string" ? detail.trim().toLowerCase() : "");

/**
 * Why a pick submit was refused. The live API answers 403 "porra is closed" for the porra itself, 403 "not a member of
 * this group" for a non-member, and 409 `{code, effective_phase, ...}` for the jornada window (one code per phase);
 * older builds sent 403 for the window too. Unknown shapes keep the generic `voting-closed`. The text is never shown.
 */
export function classifyPicksRefusal(detail: unknown): FailureCode {
  const window = windowFailureCode(detail);
  if (window) return window;
  const text = lower(detail);
  if (text.includes("not a member")) return "forbidden";
  if (text.includes("porra is closed")) return "porra-closed";
  if (/not active|inactive|draft/.test(text)) return "jornada-in-preparation";
  if (/deadline|window|voting.*clos|clos.*voting|expired/.test(text)) return "voting-window-closed";
  return "voting-closed";
}

/**
 * Body-aware 409 parsing (the status alone cannot tell the cases apart). A string detail is a porra rule
 * ("porra already exists for group_id=..", "porra is closed — cannot patch"); a dict is a jornada window refusal.
 * Anything else gives undefined, so the call falls back to the generic `conflict`.
 */
export function parsePorraConflict(context: WindowContext) {
  return (detail: unknown): ServiceError | undefined => {
    const text = lower(detail);
    if (text.startsWith("porra already exists")) return new ServiceError("porra-exists");
    if (text.startsWith("porra is closed")) return new ServiceError("porra-closed");
    return windowConflict(detail, context);
  };
}

const wirePleno = (pleno: Pleno) => ({ local: pleno.home, visitante: pleno.away });
const wirePicks = (picks: readonly Pick[]) => picks.map(p => ({ partido_orden: p.position, signs: sortSigns(p.signs) }));
/** POST /picks body: the voted columns (one for múltiple and reducida), never the rejected `picks` key. */
export const wireVote = (vote: Vote) => ({ columnas: vote.columnas.map(column => ({ matches: wirePicks(column) })), pleno: wirePleno(vote.pleno) });
/** PUT /boleto body: the printed columns, never the legacy top-level `matches`. */
export const wireBoleto = (input: BoletoInput) => ({ columnas: input.columnas.map(column => ({ matches: wirePicks(column) })), pleno: wirePleno(input.pleno) });

/**
 * The mode and its own fields, exactly as the API expects them: múltiple sends dobles/triples, sencilla its columnas,
 * reducida only the code (the API stamps dobles/triples), Intuición fijos and columnas. Never the price.
 */
export function wireSpec(spec: PorraSpec): Record<string, unknown> {
  switch (spec.modo) {
    case "multiple": return { modo: "multiple", dobles: spec.dobles, triples: spec.triples };
    case "sencilla": return { modo: "sencilla", columnas: spec.columnas };
    case "reducida": return { modo: "reducida", reduccion: spec.reduccion };
    case "intuicion": return { modo: "intuicion", fijos: spec.fijos, columnas: spec.columnas };
  }
}

export function createPorrasGateway(baseUrl: string, token: string, fetcher: typeof fetch = fetch, timeoutMs?: number): PorrasGateway {
  const request = createAuthenticatedClient(baseUrl, token, fetcher, timeoutMs);
  const base = (groupId: string) => `/groups/${encodeURIComponent(groupId)}/porras`;
  const one = (groupId: string, porraId: string) => `${base(groupId)}/${encodeURIComponent(porraId)}`;
  const orNull = async <T>(call: Promise<T>): Promise<T | null> => {
    try { return await call; } catch (error) {
      if (error instanceof ServiceError && error.code === "not-found") return null;
      throw error;
    }
  };
  return {
    async list(groupId, jornadaId) {
      const query = jornadaId ? `?jornada_id=${encodeURIComponent(jornadaId)}` : "";
      return (await request(`${base(groupId)}${query}`, z.array(porraSchema))).map(toPorra);
    },
    async formats(groupId, jornadaId, budgetEur) {
      const query = `?jornada_id=${encodeURIComponent(jornadaId)}&budget_eur=${encodeURIComponent(budgetEur)}`;
      return (await request(`${base(groupId)}/porra-formats${query}`, z.array(formatSchema), { parse422: classify422("invalid-porra") })).map(toFormat);
    },
    async create(groupId, input) {
      const body: Record<string, unknown> = { jornada_id: Number(input.jornadaId), budget_eur: input.budgetEur, ...wireSpec(input.spec) };
      return toDetail(await request(base(groupId), porraDetailSchema, {
        method: "POST", body, parseConflict: parsePorraConflict("porra"), parse422: classify422("invalid-porra"),
      }));
    },
    async get(groupId, porraId) {
      return toDetail(await request(one(groupId, porraId), porraDetailSchema));
    },
    async patch(groupId, porraId, changes) {
      const body: Record<string, unknown> = {};
      if (changes.budgetEur !== undefined) body.budget_eur = changes.budgetEur;
      if (changes.spec !== undefined) Object.assign(body, wireSpec(changes.spec));
      return toDetail(await request(one(groupId, porraId), porraDetailSchema, {
        method: "PATCH", body, parseConflict: parsePorraConflict("porra"), parse422: classify422("invalid-porra"),
      }));
    },
    async submitPicks(groupId, porraId, vote) {
      // Refusals: 403 (porra closed, non-member; older builds also deadline / inactive jornada) and 409 (jornada window).
      return toPicksView(await request(`${one(groupId, porraId)}/picks`, picksOutSchema, {
        method: "POST", body: wireVote(vote), parse422: classify422("invalid-picks"),
        classifyForbidden: classifyPicksRefusal,
        parseConflict: parsePorraConflict("picks"),
      }));
    },
    async listPicks(groupId, porraId) {
      return toPicksView(await request(`${one(groupId, porraId)}/picks`, picksOutSchema));
    },
    async myPicks(groupId, porraId) {
      const rows = await orNull(request(`${one(groupId, porraId)}/picks/me`, z.array(pickOutSchema)));
      return rows ? toSheet(rows) : null;
    },
    async propuesta(groupId, porraId) {
      return toPropuesta(await request(`${one(groupId, porraId)}/propuesta`, propuestaSchema, { method: "POST" }));
    },
    async getBoleto(groupId, porraId) {
      const wire = await orNull(request(`${one(groupId, porraId)}/boleto`, boletoSchema));
      return wire ? toBoleto(wire) : null;
    },
    async putBoleto(groupId, porraId, input) {
      return toBoleto(await request(`${one(groupId, porraId)}/boleto`, boletoSchema, {
        method: "PUT", body: wireBoleto(input), parseConflict: parsePorraConflict("boleto"), parse422: classify422("invalid-porra"),
      }));
    },
    async deleteBoleto(groupId, porraId) {
      await request(`${one(groupId, porraId)}/boleto`, z.undefined(), { method: "DELETE", parseConflict: parsePorraConflict("porra") });
    },
    async intuicionOptions(groupId, budgetEur) {
      const query = `?budget_eur=${encodeURIComponent(budgetEur)}`;
      const wire = await request(`${base(groupId)}/intuicion-options${query}`, intuicionOptionsSchema, { parse422: classify422("invalid-porra") });
      return wire.options.map(toIntuicionOption);
    },
    async boletoPdf(groupId, porraId): Promise<BoletoPdf> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs ?? 20000);
      try {
        const response = await fetcher(`${baseUrl}${one(groupId, porraId)}/boleto.pdf`, {
          method: "GET", headers: { Accept: "application/pdf", Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 401) throw new ServiceError("unauthenticated");
          if (response.status === 403) throw new ServiceError("forbidden");
          if (response.status === 404) throw new ServiceError("not-found");
          throw new ServiceError("upstream");
        }
        const contentType = response.headers.get("Content-Type") ?? "";
        if (!contentType.toLowerCase().startsWith("application/pdf")) throw new ServiceError("malformed");
        // The timer guards the wait for the headers only: the body streams on afterwards.
        return { body: response.body, contentType, contentDisposition: response.headers.get("Content-Disposition") };
      } catch (error) {
        if (error instanceof ServiceError) throw error;
        throw new ServiceError(controller.signal.aborted ? "timeout" : "network");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
