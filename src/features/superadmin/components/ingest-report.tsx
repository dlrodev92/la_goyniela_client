import { StatusBadge, panelSurface } from "./panel-ui";
import { summarizeIngest, type IngestReport } from "../domain/ingest";
import { cn } from "@/lib/cn";

const TONE_TEXT = { success: "text-success", warning: "text-warning", error: "text-danger", info: "text-fg" } as const;

const ok = (status: "ok" | "error") => <StatusBadge kind={status === "ok" ? "success" : "danger"}>{status === "ok" ? "Correcta" : "Error"}</StatusBadge>;

/** The full §6.11 response in a collapsible panel: verdict first, then one dense line per jornada for Quiniwin and Losilla. */
export function IngestReportView({ report }: { report: IngestReport }) {
  const summary = summarizeIngest(report);
  return (
    <details open className={cn(panelSurface, "text-label")}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <span className="font-medium">Resultado de la importación</span>
        <span className={TONE_TEXT[summary.tone]}>{summary.headline}</span>
      </summary>
      <div className="grid gap-3 border-t border-border-soft p-3">
        <ul className="grid gap-0.5 text-fg-muted">{summary.lines.map(line => <li key={line}>{line}</li>)}</ul>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
          <div className="flex gap-2"><dt className="text-fg-muted">Estado</dt><dd>{report.quiniwinStatus}</dd></div>
          <div className="flex gap-2"><dt className="text-fg-muted">Temporada</dt><dd>{report.season ?? "—"}</dd></div>
          <div className="flex gap-2"><dt className="text-fg-muted">Última conocida</dt><dd>{report.maxKnownJornada === null ? "—" : `J${report.maxKnownJornada}`}</dd></div>
          <div className="flex gap-2"><dt className="text-fg-muted">Correctas / fallos</dt><dd>{report.okCount} / {report.failCount}</dd></div>
        </dl>
        <section aria-label="Quiniwin" className="grid gap-1">
          <h3 className="text-meta font-medium uppercase tracking-wider text-fg-muted">Quiniwin</h3>
          {report.jornadas.length === 0 ? <p className="text-fg-muted">Quiniwin no ha devuelto jornadas.</p> : (
            <ul className="grid divide-y divide-border-soft rounded-md border border-border-soft">
              {report.jornadas.map(row => (
                <li key={row.jornada} className="grid grid-cols-[4rem_auto_1fr] items-center gap-x-3 gap-y-1 px-2 py-1.5 tabular-nums">
                  <span className="font-medium">J{row.jornada}</span>
                  {ok(row.status)}
                  <span className="text-fg-muted">
                    {row.inserted > 0 ? "Creada" : row.existing > 0 ? "Ya existía" : "—"} · composición {row.composicionInserted} nuevos / {row.composicionExisting} existentes · equipos nuevos {row.stubsCreated}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Losilla" className="grid gap-1">
          <h3 className="text-meta font-medium uppercase tracking-wider text-fg-muted">Losilla</h3>
          {report.losilla.length === 0 ? <p className="text-fg-muted">Losilla no se ha ejecutado para ninguna jornada.</p> : (
            <ul className="grid divide-y divide-border-soft rounded-md border border-border-soft">
              {report.losilla.map(row => (
                <li key={row.jornada} className="grid gap-1 px-2 py-1.5 tabular-nums">
                  <div className="grid grid-cols-[4rem_auto_1fr] items-center gap-x-3">
                    <span className="font-medium">J{row.jornada}</span>
                    {ok(row.status)}
                    <span className="text-fg-muted">
                      Escrutinio {row.escrutinioInserted ? "insertado" : row.escrutinioExisted ? "ya existía" : "aún no cerrada"} · comentarios {row.comentariosInserted} nuevos / {row.comentariosUpdated} actualizados / {row.comentariosExisting} existentes
                    </span>
                  </div>
                  {row.networkFailures.length > 0 && (
                    <ul className="list-inside list-disc break-words text-fg-muted">{row.networkFailures.map((failure, index) => <li key={`${index}-${failure}`}>Fallo de red: {failure}</li>)}</ul>
                  )}
                  {row.error && <p role="alert" className="text-danger">{row.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </details>
  );
}
