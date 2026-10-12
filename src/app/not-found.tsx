import { PublicShell } from "@/components/shell/public-shell";
import { SystemState } from "@/components/shell/system-state";
import { Button } from "@/components/ui/button";

import goal from "../../public/asset_porteria.png";

export default function NotFound() {
  return (
    <PublicShell scene="access">
      <SystemState
        illustration={goal}
        eyebrow="404"
        title="Esta página no existe"
        description="Puede que se haya movido o que la dirección sea incorrecta."
        action={<Button href="/">Volver al inicio</Button>}
      />
    </PublicShell>
  );
}
