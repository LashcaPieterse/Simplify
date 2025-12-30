import type { Metadata } from "next";
import "./globals.css";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Simplify eSIMs",
  description: "Global eSIM marketplace for instant travel connectivity.",
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-sand-50 text-brand-900 antialiased font-sans">
        <Theme accentColor="teal" grayColor="mauve" radius="large" scaling="95%">
          <Providers>{children}</Providers>
        </Theme>
      </body>
    </html>
  );
}
