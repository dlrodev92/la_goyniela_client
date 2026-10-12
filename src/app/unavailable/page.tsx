import type { Metadata } from "next";

import { PublicShell } from "@/components/shell/public-shell";
import { SystemState } from "@/components/shell/system-state";
import { Button } from "@/components/ui/button";

import card from "../../../public/asset_yellow_card.png";

export const metadata: Metadata = { title: "Servicio no disponible" };

export default function UnavailablePage() {
  return (
    <PublicShell scene="access">
      <SystemState
        illustration={card}
        eyebrow="503"
        title="Servicio no disponible"
        description="Estamos teniendo problemas. Inténtalo de nuevo en unos minutos."
        action={<Button href="/">Volver al inicio</Button>}
      />
    </PublicShell>
  );
}
