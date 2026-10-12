import type { Metadata } from "next";

import { PublicShell } from "@/components/shell/public-shell";
import { SystemState } from "@/components/shell/system-state";
import { Button } from "@/components/ui/button";

import card from "../../../public/asset_yellow_card.png";

export const metadata: Metadata = { title: "Sin acceso" };

export default function ForbiddenPage() {
  return (
    <PublicShell scene="access">
      <SystemState
        illustration={card}
        eyebrow="403"
        title="No perteneces a esta peña"
        description="Solo los miembros de una peña pueden ver sus porras. Pide el código de invitación a un administrador de la peña."
        action={<Button href="/">Volver al inicio</Button>}
      />
    </PublicShell>
  );
}
