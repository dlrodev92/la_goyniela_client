export type IngestRequest = {
  temporada?: number; jornadaRangeStart?: number; jornadaRangeEnd?: number; forwardCap?: number; fetchTimeoutSec?: number; runLosilla: boolean;
};

export type IngestJornadaRow = {
  jornada: number; status: "ok" | "error"; inserted: number; existing: number;
  composicionInserted: number; composicionExisting: number; stubsCreated: number;
};
export type IngestLosillaRow = {
  jornada: number; status: "ok" | "error"; escrutinioInserted: boolean; escrutinioExisted: boolean;
  comentariosInserted: number; comentariosUpdated: number; comentariosExisting: number; networkFailures: string[]; error: string | null;
};
export type IngestReport = {
  quiniwinStatus: "ok" | "partial" | "noop" | "error";
  season: number | null; maxKnownJornada: number | null;
  jornadas: IngestJornadaRow[]; okCount: number; failCount: number;
  losilla: IngestLosillaRow[];
};

export type IngestSummary = {
  tone: "success" | "warning" | "error" | "info";
  headline: string;
  lines: string[];
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One readable verdict plus the totals behind it, from the normalized §6.11 response. */
export function summarizeIngest(report: IngestReport): IngestSummary {
  const created = report.jornadas.reduce((sum, row) => sum + row.inserted, 0);
  const existing = report.jornadas.reduce((sum, row) => sum + row.existing, 0);
  const composicion = report.jornadas.reduce((sum, row) => sum + row.composicionInserted, 0);
  const stubs = report.jornadas.reduce((sum, row) => sum + row.stubsCreated, 0);
  const losillaFailed = report.losilla.filter(row => row.status === "error").length;
  const losillaOk = report.losilla.length - losillaFailed;
  const comentarios = report.losilla.reduce((sum, row) => sum + row.comentariosInserted + row.comentariosUpdated, 0);
  const escrutinios = report.losilla.filter(row => row.escrutinioInserted).length;
  const network = report.losilla.reduce((sum, row) => sum + row.networkFailures.length, 0);

  const lines = [
    `Quiniwin: ${plural(report.okCount, "jornada correcta", "jornadas correctas")} y ${plural(report.failCount, "fallo", "fallos")}.`,
    `Jornadas: ${plural(created, "creada", "creadas")} y ${plural(existing, "que ya existía", "que ya existían")}. Composición insertada: ${composicion} ${composicion === 1 ? "partido" : "partidos"}. Equipos nuevos sin completar: ${stubs}.`,
  ];
  if (report.losilla.length > 0) {
    lines.push(`Losilla: ${plural(losillaOk, "jornada correcta", "jornadas correctas")} y ${plural(losillaFailed, "fallo", "fallos")}. ${plural(escrutinios, "escrutinio nuevo", "escrutinios nuevos")} y ${plural(comentarios, "comentario guardado", "comentarios guardados")}.`);
  }
  if (network > 0) lines.push(`Fallos de red al consultar Losilla: ${network}.`);

  if (report.quiniwinStatus === "noop" && report.jornadas.length === 0) {
    return { tone: "info", headline: "No había nada nuevo que importar.", lines };
  }
  if (report.quiniwinStatus === "error" || (report.okCount === 0 && report.failCount > 0)) {
    return { tone: "error", headline: "La importación ha fallado.", lines };
  }
  if (report.failCount > 0 || losillaFailed > 0 || network > 0 || report.quiniwinStatus === "partial") {
    return { tone: "warning", headline: "Importación parcial: revisa los fallos.", lines };
  }
  return { tone: "success", headline: "Importación completada.", lines };
}

const INT_FIELDS = [
  ["temporada", 1998, 2100], ["jornadaRangeStart", 1, 42], ["jornadaRangeEnd", 1, 42], ["forwardCap", 1, 42],
] as const;

/** Parses the optional collapsible form. Empty fields are omitted so the backend defaults apply; returns field errors otherwise. */
export function parseIngestForm(values: Record<string, string>, runLosilla: boolean): { ok: true; request: IngestRequest } | { ok: false; fields: Record<string, string> } {
  const request: IngestRequest = { runLosilla };
  const fields: Record<string, string> = {};
  for (const [key, min, max] of INT_FIELDS) {
    const raw = (values[key] ?? "").trim();
    if (!raw) continue;
    const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(value) || value < min || value > max) fields[key] = `Usa un número entero entre ${min} y ${max}.`;
    else request[key] = value;
  }
  const timeout = (values.fetchTimeoutSec ?? "").trim().replace(",", ".");
  if (timeout) {
    const value = /^\d+(\.\d+)?$/.test(timeout) ? Number(timeout) : NaN;
    if (!Number.isFinite(value) || value < 1 || value > 120) fields.fetchTimeoutSec = "Usa un número entre 1 y 120.";
    else request.fetchTimeoutSec = value;
  }
  if (request.jornadaRangeStart !== undefined && request.jornadaRangeEnd !== undefined && request.jornadaRangeStart > request.jornadaRangeEnd) {
    fields.jornadaRangeEnd = "La jornada final no puede ser anterior a la inicial.";
  }
  return Object.keys(fields).length > 0 ? { ok: false, fields } : { ok: true, request };
}
