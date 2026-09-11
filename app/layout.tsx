import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finance Tracker — Voice-First Personal Finance",
  description: "Pencatatan keuangan pribadi harian instan dengan input suara dan pemindaian resi otomatis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="bg-bg text-text min-h-screen flex justify-center selection:bg-chip selection:text-primary">
        <main className="w-full max-w-md min-h-screen bg-bg flex flex-col relative pb-20">
          {children}
        </main>
      </body>
    </html>
  );
}
