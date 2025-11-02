import type { Metadata } from "next";
import "./globals.css";
import { Inter, Manrope } from "next/font/google";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Simplify eSIMs",
  description: "Global eSIM marketplace for instant travel connectivity."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body className="bg-sand-50 text-brand-900 antialiased">
        <Theme accentColor="teal" grayColor="mauve" radius="large" scaling="95%">
          {children}
        </Theme>
      </body>
    </html>
  );
}
