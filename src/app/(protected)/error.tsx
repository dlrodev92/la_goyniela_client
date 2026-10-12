"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function ProtectedError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <ErrorFallback
        description="No pudimos comprobar tu sesión o el servicio no está disponible. Inténtalo de nuevo."
        reset={reset}
      />
    </>
  );
}
