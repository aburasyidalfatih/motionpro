import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Library Node murni untuk antrian; biarkan di-require saat runtime, tidak di-bundle.
  serverExternalPackages: ["bullmq", "ioredis"],
};

export default nextConfig;
