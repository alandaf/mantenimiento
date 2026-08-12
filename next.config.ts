import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen de producción autocontenida (~150 MB) para el VPS.
  output: "standalone",
};

export default nextConfig;
