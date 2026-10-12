"use client";

import { useState } from "react";
import { Boleto, type BoletoFixture } from "@/features/porras/components/boleto";
import { draftFromVote, emptyDraft, formatUsage, validateVote, type BoletoDraft } from "@/features/porras/domain/logic";
import { costFor } from "@/features/porras/domain/logic";
import { FALLBACK_PRECIO_APUESTA_EUR } from "@/features/porras/domain/porras";

const MATCHES: [string, string, string, string][] = [
  ["Barcelona", "Getafe", "Barça", "Getafe"], ["Real Madrid", "Sevilla", "R. Madrid", "Sevilla"],
  ["Atlético de Madrid", "Valencia", "Atlético", "Valencia"], ["Athletic Club", "Real Sociedad", "Athletic", "R. Sociedad"],
  ["Villarreal", "Real Betis", "Villarreal", "Betis"], ["Celta de Vigo", "Osasuna", "Celta", "Osasuna"],
  ["Rayo Vallecano", "Mallorca", "Rayo", "Mallorca"], ["Girona", "Espanyol", "Girona", "Espanyol"],
  ["Deportivo Alavés", "Elche", "Alavés", "Elche"], ["Levante", "Real Oviedo", "Levante", "Oviedo"],
  ["Cádiz", "Almería", "Cádiz", "Almería"], ["Granada", "Las Palmas", "Granada", "Las Palmas"],
  ["Real Valladolid", "Leganés", "Valladolid", "Leganés"], ["Sporting de Gijón", "Real Zaragoza", "Sporting", "Zaragoza"],
  ["Real Madrid", "FC Barcelona", "R. Madrid", "Barça"],
];

export const FIXTURES: BoletoFixture[] = MATCHES.map(([homeName, awayName, homeShort, awayShort], index) => ({
  position: index + 1, homeName, awayName, homeShort, awayShort,
}));

const FINAL = draftFromVote({
  columnas: [FIXTURES.slice(0, 14).map((f, i) => ({ position: f.position, signs: i === 2 ? ["1", "X"] : i === 6 ? ["1", "X", "2"] : i % 3 === 0 ? ["1"] : i % 3 === 1 ? ["X"] : ["2"] }))],
  pleno: { home: "2", away: "1" },
});

export function BoletoVoteDemo() {
  const [draft, setDraft] = useState<BoletoDraft>(emptyDraft);
  const [showErrors, setShowErrors] = useState(false);
  const usage = formatUsage(draft);
  const errors = showErrors ? validateVote(draft) : {};
  return (
    <div className="grid gap-3">
      <Boleto mode="vote" jornada={11} temporada="2026/2027" fixtures={FIXTURES} value={draft} onChange={setDraft} errors={errors} onInfo={() => undefined} />
      <p aria-live="polite" className="text-label text-fg-muted tabular-nums">
        Simples {usage.simples} · Dobles {usage.dobles} · Triples {usage.triples} · {usage.columns} {usage.columns === 1 ? "columna" : "columnas"}
        {" · "}{costFor(usage.columns, FALLBACK_PRECIO_APUESTA_EUR)} €
      </p>
      <button type="button" onClick={() => setShowErrors(true)} className="min-h-touch w-fit rounded-pill border-2 border-border-soft bg-surface-1 px-5 shadow-hard-sm text-label font-bold text-fg">Comprobar mi boleto</button>
    </div>
  );
}

export function BoletoFinalDemo() {
  const usage = formatUsage(FINAL);
  return (
    <Boleto mode="final" jornada={11} temporada="2026/2027" fixtures={FIXTURES} value={FINAL} columns={usage.columns} costEur={costFor(usage.columns, FALLBACK_PRECIO_APUESTA_EUR) ?? undefined} />
  );
}
