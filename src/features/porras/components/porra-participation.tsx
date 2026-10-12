import type { CSSProperties } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { Hourglass } from "@phosphor-icons/react/dist/ssr/Hourglass";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusMessage } from "@/components/ui/status-message";
import type { PicksView } from "../domain/porras";
import type { BoletoFixture } from "./boleto";
import { PicksCompact } from "./picks-compact";

type Props = {
  /** Null when the participation could not be loaded. */
  view: PicksView | null;
  fixtures: readonly BoletoFixture[];
  currentUserId: string;
  avatars: Record<string, string | null>;
};

/** Who has voted; with `show_picks` each member's boleto opens in a <details>. */
export function PorraParticipation({ view, fixtures, currentUserId, avatars }: Props) {
  return (
    <Card as="section" surface={1} aria-labelledby="participation-heading" header={<h2 id="participation-heading">Participación</h2>}>
      {!view ? (
        <StatusMessage tone="error">No hemos podido cargar la participación ahora mismo. Inténtalo de nuevo más tarde.</StatusMessage>
      ) : (
        <>
          {!view.showPicks && <p className="text-label text-fg-muted">Tu peña tiene ocultos los boletos: solo se ve quién ha votado.</p>}
          <ul className="grid gap-3">
            {view.members.map((member, index) => {
              const name = member.displayName || "Jugador";
              const mine = member.userId === currentUserId;
              const row = (
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={name} alt={`Avatar de ${name}`} src={avatars[member.userId] ?? null} size="sm" className="m-0" />
                  <span className="min-w-0 break-words text-body font-bold">{name}{mine && <span className="font-normal text-fg-muted"> (tú)</span>}</span>
                </span>
              );
              const badge = member.voted
                ? <Badge tone="success" icon={<CheckCircle size={14} weight="fill" aria-hidden="true" />}>Ha votado</Badge>
                : <Badge tone="warning" icon={<Hourglass size={14} weight="fill" aria-hidden="true" />}>Pendiente</Badge>;
              return (
                <li key={member.userId} className="stagger-in border-b border-border-soft/60 pb-3 last:border-b-0 last:pb-0" style={{ "--i": index } as CSSProperties}>
                  {member.sheet ? (
                    <details className="group">
                      <summary className="fx-row -mx-2 flex min-h-touch cursor-pointer list-none items-center gap-3 rounded-control px-2 [&::-webkit-details-marker]:hidden">
                        {row}{badge}
                        <span className="shrink-0 text-meta font-bold uppercase text-action group-open:hidden">Ver boleto</span>
                        <span className="hidden shrink-0 text-meta font-bold uppercase text-action group-open:inline">Ocultar</span>
                      </summary>
                      <div className="pt-3"><PicksCompact sheet={member.sheet} fixtures={fixtures} memberName={name} /></div>
                    </details>
                  ) : (
                    <div className="flex min-h-touch items-center gap-3">{row}{badge}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
