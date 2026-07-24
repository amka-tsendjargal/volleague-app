import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Don't let Turbopack infer which directory is the top of the project
  // Let's just define it explicitly to avoid any confusion
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
