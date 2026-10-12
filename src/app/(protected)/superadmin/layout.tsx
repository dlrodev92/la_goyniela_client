import type { ReactNode } from "react";
import { requireSuperadmin } from "@/features/superadmin/server/access";

/**
 * Non-superadmins get the standard not-found page for every /superadmin route (pages and queries re-check it too).
 *
 * The panel keeps the original dark-green look while the rest of the app moves to Swiss brutalism: `data-theme="legacy"`
 * re-declares the old token values (colors, radii, borders, shadows, press feel; see "Legacy scope" in globals.css).
 * The root adopts the scope while this wrapper is mounted, so the html ground, header and bottom nav match as well.
 */
export default async function SuperadminLayout({ children }: { children: ReactNode }) {
  await requireSuperadmin();
  return <div data-theme="legacy" className="contents">{children}</div>;
}
