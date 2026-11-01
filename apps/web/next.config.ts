import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents (+ partialPrefetching) requires every dynamic data access
  // to be wrapped in Suspense or explicitly cached. Our catalog/player pages
  // are live DB-backed on every request, so leaving this off avoids fighting
  // that model for data we don't want cached.
  transpilePackages: ["@reel-and-page/shared"],
  // ffmpeg-static/ffprobe-static resolve their native binary's absolute
  // path via __dirname at require-time; Next's build-time file tracing
  // rewrites that path for its own bundle layout and breaks it (spawn
  // ENOENT on a path like "/ROOT/node_modules/..."). Marking them external
  // skips tracing/bundling so Node resolves them normally at runtime.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "fluent-ffmpeg"],
};

export default nextConfig;
