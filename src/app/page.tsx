import { PageContainer } from "@/components/shell/page-container";
import { PublicShell } from "@/components/shell/public-shell";
import { Button } from "@/components/ui/button";
import { Sticker, trims } from "@/components/ui/sticker";
import { getOptionalUser } from "@/features/auth/server/session";

import logo from "../../public/logo.png";
import scarf from "../../public/asset_scarf.png";
import ticket from "../../public/asset_ticket.png";

// Interim public home. A full landing page will replace this content later.
export default async function HomePage() {
  const user = await getOptionalUser();

  return (
    <PublicShell scene="access" priority>
      <PageContainer centered className="pt-16 md:pt-16">
        <div className="relative grid gap-5 pt-4">
          <Sticker src={logo} trim={trims.logo} width={96} tilt={-4} preload className="absolute -right-2 -top-14 sm:[--sticker-w:128px]" />
          <p className="label-meta flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-2.5 w-6 border-2 border-border-soft bg-signal" />
            <span aria-hidden="true" className="tabular-nums">01 —</span>
            La Goyniela
          </p>
          <h1 className="font-display text-[clamp(3.25rem,17vw,6.5rem)] uppercase leading-[0.86] text-fg">Juntos, una quiniela</h1>
          <p className="max-w-[34ch] border-t-(length:--bw) border-border-soft pt-4 text-body text-fg-muted">
            Cada uno vota su 1X2 y tu peña forma una quiniela común, sin discusiones.
          </p>
          <div className="relative grid w-full max-w-sm gap-3">
            {user ? (
              <Button href="/dashboard" size="lg" fullWidth>Ir a mi peña</Button>
            ) : (
              <>
                <Button href="/login" size="lg" fullWidth>Iniciar sesión</Button>
                <Button href="/register" size="lg" variant="secondary" fullWidth>Crear cuenta</Button>
              </>
            )}
          </div>
          <Sticker src={scarf} width={120} tilt={-6} className="absolute -bottom-12 -right-4 hidden sm:block" />
          <Sticker src={ticket} width={84} tilt={9} className="absolute -bottom-9 right-2 sm:hidden" />
        </div>
      </PageContainer>
    </PublicShell>
  );
}
