import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finance Tracker — Voice-First Personal Finance",
    short_name: "FinanceTracker",
    description:
      "Aplikasi pencatatan keuangan harian cerdas dengan input suara instan dan scan resi OCR.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0D0D17",
    theme_color: "#5E5CE6",
    orientation: "portrait",
    categories: ["finance", "productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
