import type { Metadata } from "next";

import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review your selected SIM.Africa travel eSIM plan before secure checkout.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Cart</p>
      <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-brand-900 sm:text-5xl">Review your eSIM</h1>
      <p className="mt-4 max-w-2xl text-brand-600">Confirm the destination, data allowance, validity, and quantity before continuing to payment.</p>
      <div className="mt-10"><CartView /></div>
    </div>
  );
}
