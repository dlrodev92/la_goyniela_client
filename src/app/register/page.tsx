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

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ invite?: string | string[] }> }) {
  // Page renders cannot delete cookies, so an invite cookie is only read here; the join page and its 1-day expiry retire it.
  if (await getOptionalUser()) redirect(await peekPostAuthPath());
  const { invite } = await searchParams;
  const invited = (Array.isArray(invite) ? invite[0] : invite) === "1";
  return (
    <AuthPage title="Únete a tu peña" description="Crea tu cuenta y vota tus pronósticos con tu grupo." sticker={{ src: administrator, trim: trims.administrator, tilt: 3 }}>
      {invited && <StatusMessage tone="success">Crea tu cuenta para unirte a la peña.</StatusMessage>}
      <RegisterForm />
      <ProviderButtons />
      <AuthSwitch>¿Ya tienes cuenta? <AppLink href="/login" indicator={false} className={authLinkClasses}>Iniciar sesión</AppLink></AuthSwitch>
    </AuthPage>
  );
}
