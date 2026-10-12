import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { NavProgress } from "@/components/shell/nav-progress";

import "./globals.css";

// Both files are fetched by `pnpm fonts:fetch` (git-ignored, ITF FFL); see scripts/fetch-fonts.mjs.
const tanker = localFont({
  src: "./fonts/Tanker-Regular.woff2",
  weight: "400",
  display: "swap",
  variable: "--font-tanker",
  adjustFontFallback: "Arial",
});

const nippo = localFont({
  src: "./fonts/Nippo-Variable.woff2",
  weight: "200 700",
  display: "swap",
  variable: "--font-nippo",
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: {
    default: "La Goyniela",
    template: "%s | La Goyniela",
  },
  description: "La quiniela de tu peña: cada uno vota su 1X2 y el grupo forma una quiniela común.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={`${tanker.variable} ${nippo.variable}`}>
      <body className="bg-canvas font-ui text-fg">
        <a
          className="fixed top-2 left-4 z-50 -translate-y-24 rounded-pill border-(length:--bw) border-edge bg-action px-4 py-3 text-label font-bold uppercase tracking-wide text-on-action shadow-hard transition-transform duration-(--duration-base) ease-enter focus:translate-y-0"
          href="#main-content"
        >
          Saltar al contenido
        </a>
        <NavProgress />
        {children}
      </body>
    </html>
  );
}
