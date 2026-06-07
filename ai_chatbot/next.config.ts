import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  output: "standalone",

  allowedDevOrigins: ["localhost", "127.0.0.1"],

  turbopack: {
    root: ".",
  },

  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "localhost:3001",
        "localhost:3002",
        "localhost:5001",
        "127.0.0.1:3000",
        "127.0.0.1:3001",
        "127.0.0.1:3002",
        "127.0.0.1:5001",
        "ai-center.egt.com",
        "ai-center-test.egt.com",
      ],
    },
  },

  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        //https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
