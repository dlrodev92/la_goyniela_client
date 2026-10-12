import type { Metadata } from "next";

import { PublicShell } from "@/components/shell/public-shell";
import { SystemState } from "@/components/shell/system-state";
import { Button } from "@/components/ui/button";

import card from "../../../public/asset_yellow_card.png";

export const metadata: Metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <PublicShell scene="access">
      <SystemState
        illustration={card}
        eyebrow="Offline"
        title="Sin conexión"
        description="Revisa tu conexión a internet e inténtalo de nuevo."
        action={<Button href="/">Volver al inicio</Button>}
      />
    </PublicShell>
  );
}
