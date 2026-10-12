import type { Metadata } from "next";
import { AppLink } from "@/components/shell/app-link";
import { redirect } from "next/navigation";
import { AuthPage, AuthSwitch, authLinkClasses } from "@/features/auth/components/auth-page";
import { ProviderButtons } from "@/features/auth/components/provider-buttons";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getOptionalUser } from "@/features/auth/server/session";
import { trims } from "@/components/ui/sticker";
import administrator from "../../../public/administrator.png";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage() {
  if (await getOptionalUser()) redirect("/dashboard");
  return (
    <AuthPage title="Únete a tu peña" description="Crea tu cuenta y vota tus pronósticos con tu grupo." sticker={{ src: administrator, trim: trims.administrator, tilt: 3 }}>
      <RegisterForm />
      <ProviderButtons />
      <AuthSwitch>¿Ya tienes cuenta? <AppLink href="/login" indicator={false} className={authLinkClasses}>Iniciar sesión</AppLink></AuthSwitch>
    </AuthPage>
  );
}
