import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RegistrarPwa } from "@/components/shared/RegistrarPwa";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://fenixhockey.com.ar"),
  title: "Fenix Roller Hockey | Club de Hockey",
  description:
    "Hockey sobre patines en línea en Neuquén. Escuela deportiva, categorías formativas y competitivas, y comunidad de familias.",
  applicationName: "Fenix Roller Hockey",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Fenix Hockey",
    statusBarStyle: "black",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-gray-950 text-white" suppressHydrationWarning>
        {children}
        {/* Sin esto ningun toast() de la app se ve: los avisos de "guardado" y
            de "error" se disparan pero no se renderizan. */}
        <Toaster />
        <RegistrarPwa />
      </body>
    </html>
  );
}
