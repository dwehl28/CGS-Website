import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CGS Golf",
    short_name: "CGS Golf",
    description:
      "CGS Golf player app for sim competitions, team scoring, player profiles, and stream-ready golf stats.",
    start_url: "/play",
    scope: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    orientation: "portrait",
    categories: ["sports", "games", "productivity"],
    icons: [
      {
        src: "/cgs-golf-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/cgs-golf-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/cgs-golf-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Player app",
        short_name: "Play",
        description: "Open the CGS Golf player app.",
        url: "/play",
        icons: [{ src: "/cgs-golf-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Competitions",
        short_name: "Comps",
        description: "Open CGS competitions.",
        url: "/competitions/cgs-ambrose-sim-night",
        icons: [{ src: "/cgs-golf-icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
