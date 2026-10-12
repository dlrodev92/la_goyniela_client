import "server-only";
import { z } from "zod";
import type { Escrutinio, JornadaBote, LosillaJornada, LosillaMatch, MatchResult, ResultsGateway } from "../domain/results";
import { parseScore } from "../domain/results";
import { plenoSharesOf, signPercentagesOf } from "../../matchdays/domain/estimates";
import { createAuthenticatedClient } from "../../../lib/http/json-client";
import { ServiceError } from "../../../lib/http/errors";

const count = z.number().int().min(0);

// Live endpoint: only the fields we render. Unknown fields are ignored; `resultado` is "2-1", "null-null" or null.
const liveSchema = z.object({
  jornada: z.number().int().positive(),
  temporada: z.number().int().positive(),
  ssr_shipped_jornada: z.number().int().nullable().optional(),
  partidos: z.array(z.object({
    orden: z.number().int().min(1).max(15),
    local: z.string(),
    visitante: z.string(),
    resultado: z.string().nullable().optional(),
  })),
});

const escrutinioBlock = z.object({
  estimada: z.boolean(),
  recaudacion_eur: z.string(),
  bote_eur: z.string(),
  jornada_etiqueta: z.number().int().positive(),
  temporada_etiqueta: z.string(),
  fecha_jornada: z.string(),
  categorias: z.array(z.object({ aciertos: z.number().int().min(0).max(15), acertantes: count, premio_eur: z.string() })),
  elige8: z.object({ acertantes: count, premio_eur: z.string() }).nullable().optional(),
});
const escrutinioSchema = z.object({ source: z.enum(["db", "upstream"]), escrutinio: escrutinioBlock });

// Amounts arrive as strings today but are tolerated as numbers; anything else is treated as absent.
const amount = z.union([z.string(), z.number()]).nullable().optional().catch(null);
const optionalText = z.string().nullable().optional().catch(null);
// Live shares are decorative: anything unexpected degrades to "not published".
const share = z.number().nullable().optional().catch(null);
const split = z.record(z.string(), z.number()).nullable().optional().catch(null);

// Full Losilla payload: schedule + comments + live pool + official prizes. Every optional piece degrades to null.
const jornadaSchema = z.object({
  jornada: z.number().int().positive(),
  temporada: z.number().int().positive(),
  ssr_shipped_jornada: z.number().int().nullable().optional(),
  recaudacion_bote_live: z.object({
    recaudacion_eur: amount, bote_estimado_eur: amount, bote_eur: amount, coste_apuesta_eur: amount,
    fecha_fin_apuestas_ts: z.number().nullable().optional().catch(null),
  }).nullable().optional().catch(null),
  escrutinio_oficial: escrutinioBlock.nullable().optional().catch(null),
  partidos: z.array(z.object({
    orden: z.number().int().min(1).max(15),
    dia: optionalText, hora: optionalText, resultado: optionalText, comentario: optionalText,
    local_corto: optionalText, visitante_corto: optionalText,
    uno_porcentaje: share, x_porcentaje: share, dos_porcentaje: share, pleno_local: split, pleno_visitante: split,
  })),
});
// The backend answers 204 (no body) when the page renders no escrutinio block.
const escrutinioOrEmpty = z.union([escrutinioSchema, z.undefined()]);

const text = (value: string | number | null | undefined): string | null => {
  const trimmed = value === null || value === undefined ? "" : String(value).trim();
  return trimmed === "" ? null : trimmed;
};

function toEscrutinio(block: z.infer<typeof escrutinioBlock>, source: Escrutinio["source"]): Escrutinio {
  return {
    estimated: block.estimada, collectedEur: block.recaudacion_eur, jackpotEur: block.bote_eur,
    matchdayLabel: block.jornada_etiqueta, seasonLabel: block.temporada_etiqueta, dateLabel: block.fecha_jornada,
    categories: block.categorias.map(item => ({ hits: item.aciertos, winners: item.acertantes, prizeEur: item.premio_eur })),
    elige8: block.elige8 ? { winners: block.elige8.acertantes, prizeEur: block.elige8.premio_eur } : null,
    source,
  };
}

/** Maps the full Losilla payload; see `LosillaJornada` for what is dropped when the provider served another jornada. */
export function toLosillaJornada(wire: z.infer<typeof jornadaSchema>, number: number): LosillaJornada {
  const foreign = wire.ssr_shipped_jornada != null && wire.ssr_shipped_jornada !== number;
  const live = wire.recaudacion_bote_live;
  const closesTs = live?.fecha_fin_apuestas_ts;
  const bote: JornadaBote | null = live && !foreign ? {
    collectedEur: text(live.recaudacion_eur), estimatedJackpotEur: text(live.bote_estimado_eur),
    jackpotEur: text(live.bote_eur), betCostEur: text(live.coste_apuesta_eur),
    bettingClosesAt: closesTs && closesTs > 0 ? new Date(closesTs * 1000).toISOString() : null,
  } : null;
  const matches: LosillaMatch[] = foreign ? [] : wire.partidos
    .map((partido): LosillaMatch => {
      const homeShort = text(partido.local_corto);
      const awayShort = text(partido.visitante_corto);
      const percentages = signPercentagesOf(partido.uno_porcentaje, partido.x_porcentaje, partido.dos_porcentaje);
      const pleno = plenoSharesOf(partido.pleno_local, partido.pleno_visitante);
      return {
        position: partido.orden, day: text(partido.dia), time: text(partido.hora),
        score: parseScore(partido.resultado), comment: text(partido.comentario),
        ...(homeShort ? { homeShort } : {}), ...(awayShort ? { awayShort } : {}),
        ...(percentages ? { percentages } : {}), ...(pleno ? { pleno } : {}),
      };
    })
    .sort((a, b) => a.position - b.position);
  const official = wire.escrutinio_oficial;
  const escrutinio = official && official.jornada_etiqueta === number ? toEscrutinio(official, "upstream") : null;
  return { matches, bote, escrutinio };
}

export function createResultsGateway(baseUrl: string, token: string, fetcher: typeof fetch = fetch, timeoutMs?: number): ResultsGateway {
  const request = createAuthenticatedClient(baseUrl, token, fetcher, timeoutMs);
  const path = (kind: "" | "/escrutinio", season: number, number: number) =>
    `/api/v1/losilla/jornada/${encodeURIComponent(String(number))}${kind}?temporada=${encodeURIComponent(String(season))}`;
  return {
    async getJornada(season, number) {
      const wire = await request(path("", season, number), z.union([jornadaSchema, z.undefined()]));
      if (!wire) return null;
      if (wire.jornada !== number || wire.temporada !== season) throw new ServiceError("not-found");
      return toLosillaJornada(wire, number);
    },
    async getMatches(season, number) {
      const wire = await request(path("", season, number), liveSchema);
      // The live endpoint may serve another matchday when the provider lacks the requested one
      // (`ssr_shipped_jornada` differs): never present those scores as this matchday's.
      if (wire.jornada !== number || wire.temporada !== season || (wire.ssr_shipped_jornada != null && wire.ssr_shipped_jornada !== number)) {
        throw new ServiceError("not-found");
      }
      const matches: MatchResult[] = wire.partidos
        .map(partido => ({ position: partido.orden, home: partido.local, away: partido.visitante, score: parseScore(partido.resultado) }))
        .sort((a, b) => a.position - b.position);
      return { matches };
    },
    async getEscrutinio(season, number) {
      const wire = await request(path("/escrutinio", season, number), escrutinioOrEmpty);
      if (!wire) return null;
      const block = wire.escrutinio;
      // A block labelled with another matchday is not this matchday's prize table.
      if (block.jornada_etiqueta !== number) return null;
      const escrutinio = toEscrutinio(block, wire.source);
      return escrutinio;
    },
  };
}
