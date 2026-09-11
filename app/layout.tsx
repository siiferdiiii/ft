import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppDataProvider } from "@/lib/context/AppDataContext";
import { PWARegister } from "@/components/features/PWARegister";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#5E5CE6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Finance Tracker — Voice-First Personal Finance",
  description: "Pencatatan keuangan pribadi harian instan dengan input suara dan pemindaian resi otomatis.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Finance Tracker",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="bg-bg text-text min-h-screen flex justify-center selection:bg-chip selection:text-primary">
        <AppDataProvider>
          <PWARegister />
          <main className="w-full max-w-md min-h-screen bg-bg flex flex-col relative pb-20">
            {children}
          </main>
        </AppDataProvider>
      </body>
    </html>
  );
}
