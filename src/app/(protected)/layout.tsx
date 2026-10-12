import { Suspense, type ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/features/auth/server/session";
import { JornadaTicker } from "@/features/jornadas/components/jornada-ticker";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell
      variant="app"
      user={{ displayName: user.displayName, avatarUrl: user.avatarUrl }}
      // Streams in after the page: no fallback, so nothing is reserved or shown until the data is there.
      ticker={<Suspense fallback={null}><JornadaTicker /></Suspense>}
    >
      {children}
    </AppShell>
  );
}
