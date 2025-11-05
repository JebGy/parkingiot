import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
    optimizePackageImports:["@prisma/client"],
    // Helpful when using server components; harmless for pages/api
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
  
};

export default nextConfig;
