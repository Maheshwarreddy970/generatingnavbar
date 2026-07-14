import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
 serverExternalPackages: ['@imgly/background-removal-node'],
  reactCompiler: true,
};

export default nextConfig;
