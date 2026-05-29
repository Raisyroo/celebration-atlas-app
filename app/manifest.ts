import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Celebration Atlas",
    short_name: "Atlas",
    description: "A guide to celebration events and places.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#050812",
    theme_color: "#050812",
    icons: [
      {
        // TODO: Replace with dedicated 192x192 and 512x512 app icons when available.
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
