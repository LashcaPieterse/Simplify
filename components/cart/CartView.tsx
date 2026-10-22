"use client";

import { useEffect, useState } from "react";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { displayRetailPrice, type RetailPrices } from "@/lib/currency";
import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";

import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/button";
import { formatCurrencyWithCode } from "@/lib/format";

export function CartView() {
  const { items: savedItems, hydrated, removeItem } = useCart();
  const { currency } = useCurrency();
  const [currentPrices, setCurrentPrices] = useState<Record<string, RetailPrices>>({});
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const packageIds = savedItems.map(item => item.packageId).sort().join("|");
  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    setPricesLoaded(false); setCurrentPrices({});
    void fetch("/api/catalog/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageIds: packageIds ? packageIds.split("|") : [] }), signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("Unavailable"); return response.json(); })
      .then((data: { packages: Array<{ id: string; externalId: string; prices: RetailPrices }> }) => {
        const prices: Record<string, RetailPrices> = {};
        for (const pkg of data.packages) { prices[pkg.id] = pkg.prices; prices[pkg.externalId] = pkg.prices; }
        if (!controller.signal.aborted) setCurrentPrices(prices);
      }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setPricesLoaded(true); });
    return () => controller.abort();
  }, [hydrated, packageIds]);
  const items = savedItems.map(item => {
    const price = currentPrices[item.packageId] && displayRetailPrice(currentPrices[item.packageId], currency);
    return { ...item, unitPriceCents: price?.cents ?? 0, currency: price?.currency ?? "NAD", available: Boolean(price) };
  });

  if (!hydrated) {
    return <div className="h-56 animate-pulse rounded-3xl bg-brand-50" aria-label="Loading cart" />;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-brand-200 bg-white px-6 py-16 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-brand-400" aria-hidden />
        <h2 className="mt-4 text-xl font-bold text-brand-900">Your cart is empty</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-brand-600">Choose a currently available plan for your destination and it will appear here.</p>
        <Button asChild className="mt-6">
          <Link href="/#destinations">Browse destinations</Link>
        </Button>
      </div>
    );
  }

  const currencies = new Set(items.map((item) => item.currency));
  const canShowCombinedTotal = currencies.size === 1 && items.every(item => item.available);
  const combinedCurrency = items[0]!.currency;
  const combinedTotal = items.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="space-y-4">
        {items.map((item) => (
          <article key={item.packageId} className="rounded-3xl border border-brand-100 bg-white p-5 shadow-subtle sm:p-6">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-500">{item.destination}</p>
                <h2 className="mt-2 text-lg font-bold text-brand-900">{item.title}</h2>
                <p className="mt-2 text-sm text-brand-600">{item.dataLabel} · {item.validityLabel}</p>
              </div>
              <button type="button" onClick={() => removeItem(item.packageId)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600" aria-label={`Remove ${item.title}`}>
                <Trash2 className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-brand-100 pt-5">
              <p className="text-sm text-brand-600">1 eSIM per checkout</p>
              <p className="text-xl font-black text-brand-900">{item.available ? formatCurrencyWithCode(item.unitPriceCents, item.currency) : pricesLoaded ? "Plan unavailable" : "Refreshing price…"}</p>
            </div>
          </article>
        ))}
      </div>

      <aside className="rounded-3xl border border-brand-100 bg-brand-50 p-6 lg:sticky lg:top-28">
        <h2 className="text-lg font-bold text-brand-900">Order summary</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4 text-brand-600"><dt>Plans</dt><dd>{items.length}</dd></div>
          <div className="flex justify-between gap-4 text-brand-600"><dt>eSIMs</dt><dd>{items.reduce((total, item) => total + item.quantity, 0)}</dd></div>
          {canShowCombinedTotal ? (
            <div className="flex justify-between gap-4 border-t border-brand-200 pt-4 text-base font-black text-brand-900"><dt>Total</dt><dd>{formatCurrencyWithCode(combinedTotal, combinedCurrency)}</dd></div>
          ) : (
            <div className="border-t border-brand-200 pt-4 text-xs leading-5 text-brand-600">Totals are shown per currency on each plan.</div>
          )}
        </dl>

        {items.length === 1 && items[0]!.available ? (
          <Button asChild className="mt-6 w-full">
            <Link href={`/checkout/new?packageId=${encodeURIComponent(items[0]!.packageId)}&quantity=${items[0]!.quantity}`}>Checkout securely</Link>
          </Button>
        ) : (
          <div className="mt-6 rounded-2xl border border-brand-200 bg-white p-4 text-sm leading-6 text-brand-700">
            The current secure fulfilment flow processes one plan at a time. Checkout each plan below so every eSIM remains linked to the correct supplier package.
            <div className="mt-4 grid gap-2">
              {items.filter(item => item.available).map((item) => (
                <Button key={item.packageId} asChild size="sm" variant="secondary" className="w-full">
                  <Link href={`/checkout/new?packageId=${encodeURIComponent(item.packageId)}&quantity=${item.quantity}`}>Checkout {item.destination}</Link>
                </Button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-brand-500">Payment is handled by the configured payment provider. SIM.Africa does not store raw card details.</p>
      </aside>
    </div>
  );
}
