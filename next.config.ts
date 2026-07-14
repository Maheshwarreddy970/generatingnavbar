import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverComponentsExternalPackages: ['sharp', '@imgly/background-removal-node', 'canvas'],
  },
  reactCompiler: true,
};

export default nextConfig;
