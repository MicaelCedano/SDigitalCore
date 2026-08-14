import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Los avatares GIF/WebP se envían como Data URL para conservar la animación
    // y se comprimen en el servidor antes de persistirse.
    serverActions: {
      bodySizeLimit: "13mb",
    },
  },
};

export default nextConfig;
