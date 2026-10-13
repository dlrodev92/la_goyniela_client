import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Read APP_URL at request time: a build-time render would bake in whatever origin the build machine had.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/register`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
