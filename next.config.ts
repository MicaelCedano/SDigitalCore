import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Los avatares GIF/WebP se envían como Data URL para conservar la animación
    // y se comprimen en el servidor antes de persistirse.
    serverActions: {
      bodySizeLimit: "13mb",
    },
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/.well-known/oauth-protected-resource",
          destination: "/api/oauth/metadata/protected-resource",
        },
        {
          source: "/.well-known/oauth-protected-resource/:path*",
          destination: "/api/oauth/metadata/protected-resource/:path*",
        },
        {
          source: "/.well-known/oauth-authorization-server",
          destination: "/api/oauth/metadata/authorization-server",
        },
      ],
    };
  },
};

export default nextConfig;
