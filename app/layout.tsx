import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SiteChrome } from "@/components/site/SiteChrome";

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
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "500x500" }],
    shortcut: "/favicon.png",
    apple: [{ url: "/favicon.png", type: "image/png", sizes: "500x500" }]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-sand-50 text-brand-900 antialiased font-sans">
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
