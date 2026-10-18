import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { SiteChrome } from "@/components/site/SiteChrome";

const dmSans = localFont({ src: "./fonts/dm-sans.ttf", variable: "--font-dm-sans", weight: "100 1000", display: "swap" });
const instrumentSerif = localFont({ src: "./fonts/instrument-serif-italic.ttf", variable: "--font-instrument-serif", weight: "400", style: "italic", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://sim.africa"),
  title: {
    default: "SIM.Africa | Travel eSIMs for Africa",
    template: "%s | SIM.Africa",
  },
  description: "Compare prepaid travel eSIM data plans for African destinations, install online, and connect when you arrive.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "SIM.Africa",
    title: "SIM.Africa | Travel eSIMs for Africa",
    description: "Africa-focused travel eSIMs from a current supplier catalogue.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "SIM.Africa | Travel eSIMs for Africa",
    description: "Africa-focused travel eSIMs from a current supplier catalogue.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
      { url: "/favicon.png?v=2", type: "image/png", sizes: "500x500" },
      { url: "/favicon.svg?v=2", type: "image/svg+xml", sizes: "any" }
    ],
    shortcut: "/favicon.ico?v=2",
    apple: [{ url: "/apple-touch-icon.png?v=2", type: "image/png", sizes: "180x180" }]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${dmSans.variable} ${instrumentSerif.variable}`} suppressHydrationWarning>
      <body className="bg-canvas font-sans text-brand-900 antialiased">
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
