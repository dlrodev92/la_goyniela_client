"use client";

import { ErrorFallback } from "@/components/error-fallback";

import "./globals.css";

/**
 * Replaces the root layout, so it brings its own <html>/<body> and imports the stylesheet itself.
 * Fonts are not loaded here: the display and UI font stacks fall back to system fonts.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body className="bg-canvas font-ui text-fg">
        <main>
          <ErrorFallback description="La aplicación encontró un error. Inténtalo de nuevo." reset={reset} />
        </main>
      </body>
    </html>
  );
}
