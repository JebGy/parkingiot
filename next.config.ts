import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@prisma/client"],
  },
};

export default nextConfig;
