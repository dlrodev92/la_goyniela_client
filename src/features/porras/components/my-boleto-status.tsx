import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** "Mi boleto": whether the caller voted, and whether the admin has already fixed the final boleto. */
export function MyBoletoStatus({ voted, hasBoleto, canVote }: { voted: boolean; hasBoleto: boolean; canVote: boolean }) {
  return (
    <Card as="section" surface={1} aria-labelledby="my-boleto-heading" header={<h2 id="my-boleto-heading">Mi boleto</h2>}>
      <div className="flex flex-wrap items-center gap-2">
        {voted
          ? <Badge tone="success" icon={<CheckCircle size={14} weight="fill" aria-hidden="true" />}>Votado</Badge>
          : <Badge tone="warning">Pendiente</Badge>}
        {hasBoleto && <Badge tone="action">Boleto de la peña listo</Badge>}
      </div>
      <p className="text-label text-fg-muted">
        {voted
          ? canVote ? "Tu boleto está guardado. Puedes cambiarlo hasta que cierre la votación." : "Tu boleto está guardado y ya no se puede cambiar."
          : canVote ? "Todavía no has rellenado tu boleto." : "No enviaste boleto en esta jornada."}
      </p>
    </Card>
  );
}
