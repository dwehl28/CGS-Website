import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dcwmkzwbhspqcawixrao.supabase.co",
        pathname: "/storage/v1/object/public/cgs-player-photos/**",
      },
    ],
  },
};

export default nextConfig;
