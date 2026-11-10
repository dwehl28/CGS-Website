import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    localPatterns: [
      { pathname: "/**", search: "" },
      { pathname: "/par3/par3-course-draw.png", search: "?v=20261105" },
    ],
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
