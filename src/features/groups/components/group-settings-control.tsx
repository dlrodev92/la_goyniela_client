"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/ui/status-message";
import { cn } from "@/lib/cn";
import { setShowPicksAction } from "../server/actions";
import { initialSettingsState } from "../application/groups";

/** Admin-only switch for prediction visibility. The backend re-checks the role on every call. */
export function GroupSettingsControl({ groupId, showPicks }: { groupId: string; showPicks: boolean }) {
  const [state, action, pending] = useActionState(setShowPicksAction.bind(null, groupId), initialSettingsState);
  return (
    <Card as="section" aria-labelledby="settings-heading" header={<h2 id="settings-heading">Ajustes de la peña</h2>}>
      <form action={action} className="flex items-start gap-4">
        <input type="hidden" name="showPicks" value={showPicks ? "false" : "true"} />
        <div className="grid min-w-0 flex-1 gap-2">
          <p id="show-picks-label" className="flex flex-wrap items-center gap-2 text-body font-bold">
            Mostrar los pronósticos del grupo
            <Badge tone={showPicks ? "action" : "outline"}>{showPicks ? "Visibles" : "Ocultos"}</Badge>
          </p>
          <p id="show-picks-help" className="text-label text-fg-muted">
            {showPicks
              ? "Todos los miembros pueden ver lo que ha votado cada uno, incluso antes de que cierre la votación. Si lo desactivas, volverán a quedar ocultos."
              : "Los miembros solo ven quién ha votado, no qué ha votado. Si lo activas, todos podrán ver los pronósticos de todos, incluso antes de que cierre la votación."}
          </p>
        </div>
        <button
          type="submit"
          role="switch"
          aria-checked={showPicks}
          aria-labelledby="show-picks-label"
          aria-describedby="show-picks-help"
          disabled={pending}
          className="tap group inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center disabled:opacity-50"
        >
          <span aria-hidden="true" className={cn(
            "relative block h-8 w-14 rounded-pill border-2 transition-colors",
            showPicks ? "border-action bg-action" : "border-border-soft bg-surface-2",
          )}>
            <span className={cn(
              "absolute top-0.5 size-6 rounded-pill transition-[left] duration-(--duration-base) ease-spring",
              showPicks ? "left-[calc(100%-1.625rem)] bg-ink" : "left-0.5 bg-fg-muted",
            )} />
          </span>
        </button>
      </form>
      <Reveal>{state.message && <StatusMessage tone={state.status === "error" ? "error" : "success"}>{state.message}</StatusMessage>}</Reveal>
    </Card>
  );
}
