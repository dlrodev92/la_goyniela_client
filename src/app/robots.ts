import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Read APP_URL at request time: a build-time render would bake in whatever origin the build machine had.
export const dynamic = "force-dynamic";

/** Only the public pages are indexable; everything behind the session (and the dev showcase) stays out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/register"],
      disallow: ["/dashboard", "/groups", "/jornadas", "/quiniela", "/profile", "/superadmin", "/invitacion", "/auth", "/dev", "/forbidden", "/unavailable", "/offline"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
