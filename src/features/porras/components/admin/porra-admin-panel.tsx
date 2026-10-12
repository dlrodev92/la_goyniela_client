"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/ui/status-message";
import { Boleto, type BoletoFixture } from "../boleto";
import { ColumnsSheet } from "../boleto/columns-sheet";
import { columnsDraftFromPropuesta, fijosOf } from "../../domain/columns";
import { costFor, draftFromPropuesta, type PorraTerms } from "../../domain/logic";
import type { PorraSpec, Propuesta } from "../../domain/porras";
import { calcularPropuestaAction } from "../../server/actions";

type Props = {
  groupId: string;
  porraId: string;
  hasBoleto: boolean;
  /** The jornada phase still allows fixing the boleto; otherwise the change and confirm links are hidden. */
  canSetBoleto: boolean;
  jornada: number;
  temporada: string;
  fixtures: BoletoFixture[];
  terms: PorraTerms;
  spec: PorraSpec;
};

/** Admin card "Boleto de la peña": computes the proposal on demand and leads to the editor that confirms the final boleto. */
export function PorraAdminPanel({ groupId, porraId, hasBoleto, canSetBoleto, jornada, temporada, fixtures, terms, spec }: Props) {
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const base = `/groups/${groupId}/porras/${porraId}`;

  const calculate = () => {
    setError(null);
    startTransition(async () => {
      const result = await calcularPropuestaAction(groupId, porraId);
      if (result.status === "ok") setPropuesta(result.propuesta);
      else setError(result.message);
    });
  };

  // The porra's own totals (apuestas and cost, from the API) are what the boleto will play in every mode; the proposal's
  // figures only describe its single column, so they are the fallback.
  const columns = terms.columns && terms.columns > 0 ? terms.columns : propuesta && propuesta.columns > 0 ? propuesta.columns : 0;
  const multiColumn = spec.modo === "sencilla" || spec.modo === "intuicion";
  const missing = propuesta?.participation.missingVoters ?? [];

  return (
    <>
    <Card as="section" surface={2} padding="lg" pixelCorner aria-labelledby="admin-boleto-heading">
      <div className="grid gap-1">
        <h2 id="admin-boleto-heading" className="font-display text-h2 uppercase">Boleto de la peña</h2>
        <p className="text-label text-fg-muted">
          {!canSetBoleto
            ? hasBoleto
              ? "El boleto de la peña ya no se puede cambiar."
              : "Ahora mismo no se puede fijar el boleto de la peña."
            : hasBoleto
              ? "Ya hay un boleto de la peña. Puedes ver el reparto de votos otra vez o cambiarlo."
              : "Calcula la propuesta con los votos de la peña, ajústala y confirma el boleto oficial."}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button fullWidth loading={pending} onClick={calculate} variant={hasBoleto && !propuesta ? "secondary" : "primary"}>
          {propuesta ? "Recalcular propuesta" : "Calcular propuesta"}
        </Button>
        {hasBoleto && canSetBoleto && <Button href={`${base}/editar`} variant="secondary" fullWidth>Cambiar el boleto</Button>}
        {hasBoleto && <Button href={`${base}/final`} variant="ghost" fullWidth>Ver boleto de la peña</Button>}
      </div>
      <div className="grid gap-4">
        <Reveal className="[--reveal-gap:1rem]">{error && <StatusMessage tone="error">{error}</StatusMessage>}</Reveal>
        <Reveal className="[--reveal-gap:1rem]">
          {propuesta && (
            <div className="grid gap-1 rounded-control bg-surface-1 p-3">
              <p className="text-label font-bold tabular-nums">{propuesta.participation.voted} de {propuesta.participation.totalMembers} han votado</p>
              {missing.length > 0 ? (
                <p className="text-label text-fg-muted">Faltan por votar: {missing.map(member => member.displayName || "Jugador").join(", ")}. Puedes confirmar el boleto sin ellos.</p>
              ) : (
                <p className="text-label text-fg-muted">Han votado todos los miembros.</p>
              )}
            </div>
          )}
        </Reveal>
      </div>
    </Card>
    {propuesta && (
      <div className="pop-in grid gap-4">
        {multiColumn ? (
          <ColumnsSheet
            jornada={jornada} temporada={temporada} fixtures={fixtures}
            columns={columnsDraftFromPropuesta(propuesta, spec).columns} pleno={propuesta.pleno}
            apuestas={columns} costEur={terms.costEur || costFor(columns, terms.precioApuestaEur) || "0.00"}
            lockedRows={fijosOf(spec)} stamp={null} caption="Propuesta calculada con los votos de la peña"
          />
        ) : (
          <Boleto
            mode="proposal"
            jornada={jornada}
            temporada={temporada}
            fixtures={fixtures}
            value={draftFromPropuesta(propuesta)}
            columns={columns}
            costEur={terms.costEur || costFor(columns, terms.precioApuestaEur) || undefined}
            stamp={null}
            proposal={{
              weights: Object.fromEntries(propuesta.matches.map(match => [match.position, match.weights])),
              pleno: propuesta.pleno,
            }}
          />
        )}
        {canSetBoleto && <Button href={`${base}/editar`} fullWidth>Ajustar y confirmar</Button>}
      </div>
    )}
    </>
  );
}
