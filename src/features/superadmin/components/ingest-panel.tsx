"use client";

import { useActionState } from "react";
import { CloudArrowDown } from "@phosphor-icons/react/dist/ssr/CloudArrowDown";
import { ArrowLineRight } from "@phosphor-icons/react/dist/ssr/ArrowLineRight";
import { ingestAction, type IngestState } from "../server/actions";
import { initialActionState } from "../domain/admin";
import { IngestReportView } from "./ingest-report";
import { PanelButton } from "./panel-ui";

const initial: IngestState = initialActionState;

/**
 * Two one-click imports with the cron's defaults: the next new jornada only, or every jornada Quiniwin already publishes (up to
 * the backend's forward cap). The ingest never duplicates known jornadas, so no confirmation is needed. Never retried
 * automatically; the report opens in a collapsible panel on the same page.
 */
export function IngestPanel() {
  const [state, action, pending] = useActionState(ingestAction, initial);
  return (
    <div className="grid gap-2">
      <form action={action} className="flex flex-wrap items-center justify-end gap-2">
        <input type="hidden" name="runLosilla" value="true" />
        {pending && <p role="status" className="text-label text-fg-muted">Importando… puede tardar un minuto.</p>}
        <PanelButton type="submit" name="forwardCap" value="1" variant="ghost" loading={pending}>
          <ArrowLineRight size={16} weight="bold" aria-hidden="true" />
          Traer próxima jornada
        </PanelButton>
        <PanelButton type="submit" name="forwardCap" value="5" variant="primary" loading={pending}>
          <CloudArrowDown size={16} weight="bold" aria-hidden="true" />
          Traer jornadas disponibles
        </PanelButton>
      </form>
      {state.status === "error" && <p role="alert" className="text-right text-label text-danger">{state.message}</p>}
      {state.report && <IngestReportView report={state.report} />}
    </div>
  );
}
