"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";

import { HeaderActions } from "@/components/cms/HeaderActions";
import { useCart } from "@/components/cart/CartProvider";
import { WhatsAppSupportLink } from "@/components/site/WhatsAppSupportLink";

const navigation: Array<{ label: string; href: Route }> = [
  { label: "Destinations", href: "/#destinations" },
  { label: "Regional eSIMs", href: "/regional-esims" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Business", href: "/business" },
  { label: "Help", href: "/help" },
];

function Brand() {
  return (
    <span className="font-display text-xl font-black tracking-[-0.04em] text-brand-900 sm:text-2xl">
      SIM<span className="text-sand-500">.</span>Africa
    </span>
  );
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { itemCount, hydrated } = useCart();
  const hideChrome = pathname.startsWith("/admin");

  if (hideChrome) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-md bg-white px-4 py-3 font-semibold text-brand-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-brand-100/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-20 lg:px-8">
          <Link href="/" aria-label="SIM.Africa home" className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-brand-700 lg:flex" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link key={item.label} href={item.href} className="rounded-md px-1 py-2 transition hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden md:block">
              <HeaderActions />
            </div>
            <Link
              href="/cart"
              aria-label={`Cart with ${hydrated ? itemCount : 0} items`}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-800 transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden />
              {hydrated && itemCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sand-500 px-1 text-[0.65rem] font-bold text-white">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-brand-800 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 lg:hidden"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((current) => !current)}
            >
              {menuOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav id="mobile-navigation" className="border-t border-brand-100 bg-white px-4 py-4 lg:hidden" aria-label="Mobile navigation">
            <div className="mx-auto grid max-w-7xl gap-1">
              {navigation.map((item) => (
                <Link key={item.label} href={item.href} className="rounded-xl px-4 py-3 text-base font-semibold text-brand-800 hover:bg-brand-50" onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              ))}
              <div className="my-2 h-px bg-brand-100" />
              <Link href="/account" className="rounded-xl px-4 py-3 text-base font-semibold text-brand-800 hover:bg-brand-50" onClick={() => setMenuOpen(false)}>
                Account &amp; orders
              </Link>
            </div>
          </nav>
        ) : null}
      </header>
      <main id="main-content">{children}</main>
      <footer className="mt-20 border-t border-brand-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
          <div>
            <Brand />
            <p className="mt-3 max-w-sm text-sm leading-6 text-brand-600">
              Africa-focused travel eSIMs, selected from the current supplier catalogue.
            </p>
            <p className="mt-5 text-xs text-brand-500">© {new Date().getFullYear()} SIM.Africa. All rights reserved.</p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-brand-900">Explore</h2>
            <div className="mt-3 grid gap-2 text-sm text-brand-600">
              <Link href="/#destinations">Destinations</Link>
              <Link href="/regional-esims">Regional eSIMs</Link>
              <Link href="/route-builder">Build a route</Link>
              <Link href="/compatibility">Device compatibility</Link>
              <Link href="/business">Business travel</Link>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold text-brand-900">Support &amp; legal</h2>
            <div className="mt-3 grid gap-2 text-sm text-brand-600">
              <Link href="/help">Help centre</Link>
              <a href="mailto:support@sim.africa">support@sim.africa</a>
              <WhatsAppSupportLink location="footer" />
              <Link href="/refunds">Refund information</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
