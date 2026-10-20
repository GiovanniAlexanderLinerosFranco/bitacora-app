import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Attachment uploads go through server actions (max file 10 MB + form overhead).
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
