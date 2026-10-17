"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { trackEvent } from "@/lib/analytics";

export type CartItem = {
  packageId: string;
  title: string;
  destination: string;
  dataLabel: string;
  validityLabel: string;
  unitPriceCents: number;
  currency: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  hydrated: boolean;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (packageId: string) => void;
  clearCart: () => void;
};

const STORAGE_KEY = "sim-africa-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.packageId === "string" &&
    typeof item.title === "string" &&
    typeof item.destination === "string" &&
    typeof item.dataLabel === "string" &&
    typeof item.validityLabel === "string" &&
    typeof item.unitPriceCents === "number" &&
    Number.isFinite(item.unitPriceCents) &&
    item.unitPriceCents > 0 &&
    typeof item.currency === "string" &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        setItems(parsed.filter(isCartItem).map((item) => ({ ...item, quantity: 1 })));
      }
    } catch (error) {
      console.warn("Could not restore the shopping cart", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      hydrated,
      addItem: (incoming) => {
        const quantity = 1;
        setItems((current) => {
          const existing = current.find((item) => item.packageId === incoming.packageId);
          if (!existing) return [...current, { ...incoming, quantity }];
          return current.map((item) =>
            item.packageId === incoming.packageId
              ? { ...item, quantity }
              : item,
          );
        });
        trackEvent("add_to_cart", {
          package_id: incoming.packageId,
          destination: incoming.destination,
          currency: incoming.currency,
          value: incoming.unitPriceCents / 100,
        });
      },
      removeItem: (packageId) => {
        setItems((current) => current.filter((item) => item.packageId !== packageId));
        trackEvent("remove_from_cart", { package_id: packageId });
      },
      clearCart: () => setItems([]),
    }),
    [hydrated, items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
