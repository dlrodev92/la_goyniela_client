import type { Metadata } from "next";
import { AppLink } from "@/components/shell/app-link";
import { redirect } from "next/navigation";
import { StatusMessage } from "@/components/ui/status-message";
import { AuthPage, AuthSwitch, authLinkClasses } from "@/features/auth/components/auth-page";
import { LoginForm } from "@/features/auth/components/login-form";
import { ProviderButtons } from "@/features/auth/components/provider-buttons";
import { loginErrorMessage } from "@/features/auth/domain/oauth";
import { getOptionalUser } from "@/features/auth/server/session";
import { trims } from "@/components/ui/sticker";
import vote from "../../../public/vote_image.png";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  // Stale or inactive sessions resolve to null (no redirect), so an old cookie can never loop back here.
  if (await getOptionalUser()) redirect("/dashboard");
  const { error } = await searchParams;
  const message = loginErrorMessage(Array.isArray(error) ? error[0] : error);
  return (
    <AuthPage title="Vuelve a tu peña" description="Entra para votar tus pronósticos de la jornada." sticker={{ src: vote, trim: trims.vote, tilt: 5 }}>
      {message && <StatusMessage tone="error">{message}</StatusMessage>}
      <LoginForm />
      <ProviderButtons />
      <AuthSwitch>¿No tienes cuenta? <AppLink href="/register" indicator={false} className={authLinkClasses}>Crear cuenta</AppLink></AuthSwitch>
    </AuthPage>
  );
}
