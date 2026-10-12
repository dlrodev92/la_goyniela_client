import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CodeInput } from "@/components/ui/code-input";
import { Divider } from "@/components/ui/divider";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Progress } from "@/components/ui/progress";
import { ProviderButton } from "@/components/ui/provider-button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusMessage } from "@/components/ui/status-message";
import { TeamCrest } from "@/components/ui/team-crest";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { BoletoFinalDemo, BoletoVoteDemo } from "./boleto-demos";
import { ConfirmDemo, PlenoDemo, SignToggleDemo } from "./interactive-demos";

export const metadata: Metadata = { title: "Kit de interfaz (dev)", robots: { index: false } };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4" aria-label={title}>
      <h2 className="font-display text-h2 uppercase text-action">{title}</h2>
      {children}
    </section>
  );
}

export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main id="main-content" className="brut-panel mx-auto my-6 grid w-[calc(100%-2rem)] max-w-5xl gap-12 p-5 sm:my-10 sm:p-8">
      <header className="grid gap-2">
        <h1 className="font-display text-display uppercase">Kit de interfaz</h1>
        <p className="text-body text-fg-muted">Brutalismo suizo por fuera, píxeles por dentro. Vista previa solo en desarrollo.</p>
      </header>

      <Section title="Botones">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button variant="primary">Enviar pronóstico</Button>
          <Button variant="secondary">Ver peña</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="danger">Eliminar</Button>
          <Button variant="primary" size="lg" trailingIcon={<ArrowRight size={20} weight="bold" aria-hidden="true" />}>Grande</Button>
          <Button variant="secondary" leadingIcon={<Plus size={20} weight="bold" aria-hidden="true" />}>Crear peña</Button>
          <Button variant="primary" loading>Guardando</Button>
          <Button variant="primary" disabled>Deshabilitado</Button>
          <Button href="/dev/ui" variant="secondary">Enlace</Button>
          <Button href="/dev/ui" variant="primary" disabled>Enlace off</Button>
          <Button variant="danger" loading>Eliminando</Button>
          <Button variant="primary" fullWidth className="sm:col-span-2">Ancho completo</Button>
        </div>
      </Section>

      <Section title="Acceso con proveedores">
        <div className="grid max-w-sm gap-3">
          <ProviderButton provider="google" href="/auth/google" />
          <ProviderButton provider="x" href="/auth/x" />
          <Divider label="o" />
          <ProviderButton provider="google" href="/auth/google" loading />
          <ProviderButton provider="x" href="/auth/x" disabled helperText="No disponible por ahora" />
        </div>
      </Section>

      <Section title="Campos">
        <form className="grid max-w-md gap-4" action="#">
          <Field id="demo-email" label="Correo electrónico" hint="Usaremos este correo para tu cuenta." required>
            {(c) => <TextInput {...c} name="email" type="email" autoComplete="email" placeholder="marta@ejemplo.es" />}
          </Field>
          <Field id="demo-pass" label="Contraseña" error="La contraseña debe tener al menos 8 caracteres." required>
            {(c) => <PasswordInput {...c} name="password" autoComplete="new-password" defaultValue="abc" />}
          </Field>
          <Field id="demo-name" label="Nombre de la peña" hint="Máximo 40 caracteres.">
            {(c) => <TextInput {...c} name="name" defaultValue="Los del Bar Manolo" />}
          </Field>
          <Field id="demo-desc" label="Descripción">
            {(c) => <TextArea {...c} name="desc" placeholder="Quiniela de los jueves en el bar" />}
          </Field>
          <Field id="demo-code" label="Código de la peña" hint="Te lo da quien administra la peña.">
            {(c) => <CodeInput {...c} name="code" defaultValue="rondo7k" />}
          </Field>
          <Field id="demo-off" label="Campo deshabilitado">
            {(c) => <TextInput {...c} name="off" disabled defaultValue="No editable" />}
          </Field>
        </form>
      </Section>

      <Section title="Pronóstico 1 X 2">
        <div className="grid max-w-sm gap-4">
          <SignToggleDemo />
          <SignToggleDemo disabled />
          <PlenoDemo />
        </div>
      </Section>

      <Section title="Boleto">
        <h3 className="font-display text-h2 uppercase text-fg">Votar (interactivo)</h3>
        <BoletoVoteDemo />
        <h3 className="font-display text-h2 uppercase text-fg">Boleto final (solo lectura)</h3>
        <BoletoFinalDemo />
      </Section>

      <Section title="Tarjetas, insignias y avatares">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card surface={1} header="Peña El Rondo">
            <p className="text-body text-fg-muted">12 miembros</p>
            <div className="flex flex-wrap gap-2"><Badge tone="action">Admin</Badge><Badge tone="neutral">Miembro</Badge></div>
          </Card>
          <Card surface={2} pixelCorner header="Jornada 12">
            <p className="text-body text-fg-muted">Cierra el sábado a las 18:00</p>
            <div className="flex flex-wrap gap-2"><Badge tone="success">Votado</Badge><Badge tone="warning">Pendiente</Badge></div>
          </Card>
          <Card as="article" surface={3} padding="lg">
            <p className="text-body">Tarjeta con más espacio.</p>
            <div className="flex flex-wrap gap-2"><Badge tone="danger">Cerrada</Badge><Badge tone="outline">Borrador</Badge></div>
          </Card>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Avatar name="Marta Ruiz" alt="Avatar de Marta Ruiz" size="sm" />
          <Avatar name="Marta Ruiz" alt="Avatar de Marta Ruiz" size="md" />
          <Avatar name="Marta Ruiz" alt="Avatar de Marta Ruiz" size="lg" />
          <Avatar name="Los del Bar Manolo" alt="Avatar de Los del Bar Manolo" src="/logo.png" size="lg" />
          <Avatar name="" alt="Avatar sin nombre" size="md" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <TeamCrest name="Real Sociedad B" size="sm" />
          <TeamCrest name="R. Oviedo" size="md" />
          <TeamCrest name="Celta Fortuna" size="lg" />
          <TeamCrest name="Con logo real" logoUrl="/logo.png" size="lg" />
          <TeamCrest name="Logo roto" logoUrl="https://example.invalid/missing.png" size="lg" />
        </div>
      </Section>

      <Section title="Progreso y separadores">
        <div className="grid max-w-md gap-4">
          <Progress value={9} max={15} label="Partidos pronosticados" />
          <Progress value={15} max={15} label="Quiniela completa" />
          <Progress value={0} max={15} label="Sin pronósticos" />
          <Progress value={40} max={100} label="Avance continuo" />
          <Divider />
          <Divider label="o" />
        </div>
      </Section>

      <Section title="Estados">
        <div className="grid max-w-md gap-3">
          <StatusMessage tone="info">Los pronósticos se cierran el sábado.</StatusMessage>
          <StatusMessage tone="success">Pronóstico guardado.</StatusMessage>
          <StatusMessage tone="error">No se pudo guardar. Revisa tu conexión.</StatusMessage>
        </div>
        <Card surface={1} padding="lg">
          <EmptyState
            illustration="/asset_jersey.png"
            title="Aún no tienes peñas"
            description="Crea una peña o únete con el código que te pasen tus amigos."
            action={<Button variant="primary" leadingIcon={<Plus size={20} weight="bold" aria-hidden="true" />}>Crear peña</Button>}
          />
        </Card>
        <div className="grid max-w-md gap-3" aria-busy="true">
          <span className="sr-only">Cargando</span>
          <Skeleton variant="card" />
          <Skeleton variant="line" />
          <Skeleton variant="line" className="w-1/2" />
          <Skeleton variant="block" />
        </div>
      </Section>

      <Section title="Confirmación">
        <ConfirmDemo />
      </Section>
    </main>
  );
}
