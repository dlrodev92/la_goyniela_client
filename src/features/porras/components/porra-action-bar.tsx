import { AppLink } from "@/components/shell/app-link";
import { buttonClasses } from "@/components/ui/button";

type Props = { groupId: string; porraId: string; canVote: boolean; reason: string | null; voted: boolean; hasBoleto: boolean };

/**
 * Sticky bar above the bottom nav. The boleto link is the opener of the intercepted route (`data-boleto-opener`
 * gets the focus back when the sheet closes). `.porra-bar` is shifted or hidden by the sheet through CSS.
 */
export function PorraActionBar({ groupId, porraId, canVote, reason, voted, hasBoleto }: Props) {
  const base = `/groups/${groupId}/porras/${porraId}`;
  return (
    <div className="porra-bar fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 border-t-(length:--shell-edge) border-(--shell-edge-color) bg-(--shell-bg) [backdrop-filter:var(--shell-blur)]">
      <div className="mx-auto grid max-w-160 gap-1 px-4 py-2">
        {canVote ? (
          <AppLink href={`${base}/boleto`} data-boleto-opener className={buttonClasses({ fullWidth: true })}>
            {voted ? "Editar mi boleto" : "Rellenar mi boleto"}
          </AppLink>
        ) : (
          <>
            <span role="link" aria-disabled="true" className={buttonClasses({ fullWidth: true, disabled: true })}>{voted ? "Editar mi boleto" : "Rellenar mi boleto"}</span>
            {reason && <p className="text-center text-meta text-fg-muted">{reason}</p>}
            {voted && <AppLink href={`${base}/boleto`} data-boleto-opener indicator={false} className="fx-link inline-flex min-h-touch items-center justify-center self-center justify-self-center text-label font-bold text-action no-underline">Ver mi boleto</AppLink>}
          </>
        )}
        {hasBoleto && (
          <AppLink href={`${base}/final`} transitionTypes={["nav-forward"]} indicator={false} className="fx-link inline-flex min-h-touch items-center justify-center self-center justify-self-center text-label font-bold text-action no-underline">Ver boleto de la peña</AppLink>
        )}
      </div>
    </div>
  );
}
