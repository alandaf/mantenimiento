import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen de producción autocontenida (~150 MB) para el VPS.
  output: "standalone",
  experimental: {
    // Los adjuntos viajan por server action. El límite por defecto es 1 MB,
    // menos que una foto de celular; se deja algo sobre los 10 MB que acepta
    // la aplicación para que el rechazo lo dé ella, con un mensaje claro, y
    // no el servidor con un error genérico.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
