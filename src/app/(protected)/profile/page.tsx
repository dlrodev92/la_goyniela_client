import type { Metadata } from "next";
import administrator from "../../../../public/administrator.png";
import { Sticker, trims } from "@/components/ui/sticker";
import { PageContainer } from "@/components/shell/page-container";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { displayEmail } from "@/features/auth/domain/auth";
import { requireUser } from "@/features/auth/server/session";
import { logoutAction } from "@/features/auth/server/actions";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { AvatarForm } from "@/features/profile/components/avatar-form";
import { formatDate } from "@/lib/format-date";
import { isSuperadmin } from "@/features/superadmin/server/access";
import { Button } from "@/components/ui/button";
import { ShieldStar } from "@phosphor-icons/react/dist/ssr/ShieldStar";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const email = displayEmail(user);
  const memberSince = formatDate(user.createdAt);
  // Entry point to the admin panel, only for superadmins (the flag, or a successful admin probe; the backend enforces it anyway).
  const superadmin = await isSuperadmin();
  return (
    <PageContainer eyebrow="Tu cuenta" title="Perfil" sticker={<Sticker src={administrator} trim={trims.administrator} width={72} tilt={3} className="absolute -right-2 -top-14 sm:[--sticker-w:88px]" />}>
      <Card as="section" surface={2} padding="lg" pixelCorner aria-labelledby="profile-heading" className="justify-items-center text-center">
        <Avatar name={user.displayName} alt={`Avatar de ${user.displayName}`} src={user.avatarUrl} size="xl" />
        <h2 id="profile-heading" className="break-words font-display text-h1 uppercase">{user.displayName}</h2>
        <dl className="grid w-full gap-3 text-left">
          {email && (
            <div className="grid gap-0.5 rounded-control bg-surface-3 px-3 py-2">
              <dt className="text-meta font-bold uppercase tracking-wider text-fg-muted">Correo</dt>
              <dd className="break-all text-label">{email}</dd>
            </div>
          )}
          {memberSince && (
            <div className="grid gap-0.5 rounded-control bg-surface-3 px-3 py-2">
              <dt className="text-meta font-bold uppercase tracking-wider text-fg-muted">Miembro desde</dt>
              <dd className="text-label">{memberSince}</dd>
            </div>
          )}
        </dl>
      </Card>
      <Card as="section" surface={1} aria-labelledby="picture-heading" header={<h2 id="picture-heading">Foto de perfil</h2>}>
        <AvatarForm hasAvatar={user.avatarUrl !== null} />
      </Card>
      {superadmin && (
        <Button href="/superadmin" variant="secondary" fullWidth leadingIcon={<ShieldStar size={20} weight="bold" aria-hidden="true" />}>Panel de superadmin</Button>
      )}
      <ConfirmSheet
        triggerLabel="Cerrar sesión"
        title="¿Cerrar sesión?"
        description="Tendrás que iniciar sesión de nuevo para volver a entrar en tus peñas."
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        tone="default"
        action={logoutAction}
        className="w-full"
      />
    </PageContainer>
  );
}
