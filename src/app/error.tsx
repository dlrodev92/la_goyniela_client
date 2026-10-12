"use client";

import { ErrorFallback } from "@/components/error-fallback";
import { PublicShell } from "@/components/shell/public-shell";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PublicShell scene="access">
      <ErrorFallback description="No pudimos cargar esta página. Inténtalo de nuevo." reset={reset} />
    </PublicShell>
  );
}
