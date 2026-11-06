import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "House Fines",
    short_name: "Fines",
    description: "Weekly fines night for the house.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0620",
    theme_color: "#0d0620",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
