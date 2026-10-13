import type { Metadata } from "next";
import { AppLink } from "@/components/shell/app-link";
import { redirect } from "next/navigation";
import { StatusMessage } from "@/components/ui/status-message";
import { AuthPage, AuthSwitch, authLinkClasses } from "@/features/auth/components/auth-page";
import { ProviderButtons } from "@/features/auth/components/provider-buttons";
import { RegisterForm } from "@/features/auth/components/register-form";
import { peekPostAuthPath } from "@/features/auth/server/post-auth";
import { getOptionalUser } from "@/features/auth/server/session";
import { trims } from "@/components/ui/sticker";
import administrator from "../../../public/administrator.png";

type Search = { invite?: string | string[] };
const isInvited = (invite: Search["invite"]) => (Array.isArray(invite) ? invite[0] : invite) === "1";

/** Invite links land here (via /invitacion/[code]), so the link preview in WhatsApp & co. reads as an invitation. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  if (!isInvited((await searchParams).invite)) return { title: "Crear cuenta", alternates: { canonical: "/register" } };
  const title = "Te han invitado a una peña";
  const description = "Crea tu cuenta en La Goyniela y únete a la quiniela de tu peña: vota tu 1X2 y el pleno al 15 con tus amigos.";
  const images = [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "La Goyniela" }];
  return { title, description, robots: { index: false }, alternates: { canonical: "/register" }, openGraph: { type: "website", locale: "es_ES", siteName: "La Goyniela", url: "/register", title: `${title} · La Goyniela`, description, images }, twitter: { card: "summary_large_image", title: `${title} · La Goyniela`, description, images } };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Search> }) {
  // Page renders cannot delete cookies, so an invite cookie is only read here; the join page and its 1-day expiry retire it.
  if (await getOptionalUser()) redirect(await peekPostAuthPath());
  const invited = isInvited((await searchParams).invite);
  return (
    <AuthPage title="Únete a tu peña" description="Crea tu cuenta y vota tus pronósticos con tu grupo." sticker={{ src: administrator, trim: trims.administrator, tilt: 3 }}>
      {invited && <StatusMessage tone="success">Crea tu cuenta para unirte a la peña.</StatusMessage>}
      <RegisterForm />
      <ProviderButtons />
      <AuthSwitch>¿Ya tienes cuenta? <AppLink href="/login" indicator={false} className={authLinkClasses}>Iniciar sesión</AppLink></AuthSwitch>
    </AuthPage>
  );
}
