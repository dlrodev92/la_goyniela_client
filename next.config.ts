import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avatar uploads (max 5 MB) go through a server action; the default 1 MB body limit would reject them.
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
    // Intent prefetch (AppLink) caches a full dynamic page in the client router; keep it short so live data stays fresh.
    staleTimes: { dynamic: 0, static: 30 },
  },
  // Keep the dev badge off the bottom navigation.
  devIndicators: { position: "top-right" },
  // Results moved into the jornada detail. Next keeps the original query string (e.g. ?group=) on redirects.
  async redirects() {
    return [
      { source: "/results", destination: "/jornadas", permanent: false },
      { source: "/results/:matchdayId", destination: "/jornadas/:matchdayId", permanent: false },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
