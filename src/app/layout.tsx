import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Quiniela Mundial 2026",
  description: "Quiniela familiar del Mundial FIFA 2026",
  manifest: "/manifest.json",
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Quiniela 2026" },
};

export const viewport: Viewport = {
  themeColor: "#030712",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
