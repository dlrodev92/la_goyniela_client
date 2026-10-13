import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { NavProgress } from "@/components/shell/nav-progress";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

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

// Icons, the Open Graph card and the manifest come from the file conventions in this folder (icon.png, apple-icon.png,
// opengraph-image.png, twitter-image.png, manifest.ts).
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} · La quiniela de tu peña`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["quiniela", "peña", "quiniela con amigos", "1X2", "pleno al 15", "LaLiga", "pronósticos", "porra"],
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: SITE_NAME,
    title: `${SITE_NAME} · La quiniela de tu peña`,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · La quiniela de tu peña`,
    description: SITE_DESCRIPTION,
  },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#002600",
  colorScheme: "dark light",
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
