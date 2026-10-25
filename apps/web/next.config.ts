import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents (+ partialPrefetching) requires every dynamic data access
  // to be wrapped in Suspense or explicitly cached. Our catalog/player pages
  // are live DB-backed on every request, so leaving this off avoids fighting
  // that model for data we don't want cached.
  transpilePackages: ["@reel-and-page/shared"],
};

export default nextConfig;
