"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/components/cart/CartProvider";
import { CurrencyProvider } from "@/components/currency/CurrencyProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CurrencyProvider><CartProvider>{children}</CartProvider></CurrencyProvider>
    </SessionProvider>
  );
}
