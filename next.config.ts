import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The home directory also has a lockfile. Tracing from there would ship the wrong files.
  outputFileTracingRoot: path.join(__dirname),
  // Attachment uploads go through server actions (max file 10 MB + form overhead).
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
