"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CURRENCIES, displayRetailPrice, isCurrency, type Currency, type RetailPrices } from "@/lib/currency";

type CurrencyContextValue = { currency: Currency; ready: boolean; pending: boolean; error: string | null; selectCurrency: (currency: Currency) => Promise<void> };
const CurrencyContext = createContext<CurrencyContextValue>({ currency: "USD", ready: false, pending: false, error: null, selectCurrency: async () => {} });

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (status === "loading") return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/currency-preference", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const data = await response.json();
        if (isCurrency(data.currency)) {
          setCurrency(data.currency);
          if (data.needsAdoption) await fetch("/api/currency-preference", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency: data.currency }), signal: controller.signal });
        }
      } catch { /* Public prices remain usable in USD if preferences are unavailable. */ }
      finally { if (!controller.signal.aborted) setReady(true); }
    })();
    return () => controller.abort();
  }, [status, session?.user?.id]);
  const selectCurrency = useCallback(async (next: Currency) => {
    setPending(true); setError(null);
    try {
      const response = await fetch("/api/currency-preference", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency: next }) });
      if (!response.ok) throw new Error("Unable to save your currency. Please try again.");
      setCurrency(next);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save currency."); }
    finally { setPending(false); }
  }, []);
  return <CurrencyContext.Provider value={{ currency, ready, pending, error, selectCurrency }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() { return useContext(CurrencyContext); }

export function CurrencySelector({ label = "Currency", disabled = false }: { label?: string; disabled?: boolean }) {
  const { currency, ready, pending, error, selectCurrency } = useCurrency();
  return <div><label className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700"><span className="sr-only">{label}</span><select aria-label={label} value={currency} disabled={disabled || pending || !ready} onChange={event => void selectCurrency(event.target.value as Currency)} className="h-11 rounded-full border border-brand-200 bg-white px-3 text-sm text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">{CURRENCIES.map(code => <option key={code} value={code}>{code}</option>)}</select></label>{error ? <span role="alert" className="block max-w-48 text-xs text-rose-700">{error}</span> : null}</div>;
}

export function RetailPrice({ prices, fallback = "Price unavailable" }: { prices?: RetailPrices; fallback?: React.ReactNode }) {
  const { currency } = useCurrency();
  const price = prices && displayRetailPrice(prices, currency);
  if (!price) return <>{fallback}</>;
  return <>{new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency, currencyDisplay: "code", minimumFractionDigits: 2 }).format(price.amount)}</>;
}

export function useCurrencyPlans<T extends { price: { cents: number; amount: number; currency: string }; retailPrices?: RetailPrices }>(plans: T[]): T[] {
  const { currency } = useCurrency();
  return plans.map(plan => {
    const price = plan.retailPrices && displayRetailPrice(plan.retailPrices, currency);
    return price ? { ...plan, price } : plan;
  });
}
