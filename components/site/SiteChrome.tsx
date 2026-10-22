"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { HeaderActions } from "@/components/cms/HeaderActions";
import { CurrencySelector } from "@/components/currency/CurrencyProvider";
import { useCart } from "@/components/cart/CartProvider";
import { WhatsAppSupportLink } from "@/components/site/WhatsAppSupportLink";
import { Brand } from "@/components/site/Brand";
import { cn } from "@/components/utils";

const navigation: Array<{ label: string; href: Route }> = [
  { label: "Destinations", href: "/destinations" },
  { label: "Regional eSIMs", href: "/regional-esims" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Business", href: "/business" },
  { label: "Help centre", href: "/help" },
];

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { itemCount, hydrated } = useCart();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuOpen) { setMenuOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  if (pathname.startsWith("/admin")) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="sr-only z-[100] rounded-lg bg-white px-4 py-3 font-semibold text-brand-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <header className="sticky top-0 z-50 border-b border-brand-100/80 bg-canvas/95 backdrop-blur-md">
        <div className="page-container flex h-[76px] items-center justify-between gap-5 lg:h-[88px]">
          <Link href="/" aria-label="SIM.Africa home" className="shrink-0 rounded-lg"><Brand /></Link>
          <nav className="hidden items-center gap-6 text-[13px] font-medium text-brand-600 xl:gap-8 lg:flex" aria-label="Main navigation">
            {navigation.map((item) => {
              const active = pathname === item.href || (item.href === "/destinations" && pathname.startsWith("/country/"));
              return <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={cn("relative rounded-md py-3 transition-colors hover:text-brand-900", active && "font-semibold text-brand-900 after:absolute after:inset-x-0 after:bottom-1 after:h-0.5 after:bg-brand-900")}>{item.label}</Link>;
            })}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <CurrencySelector />
            <div className="hidden md:block"><HeaderActions /></div>
            <Link href="/cart" aria-label={`Cart with ${hydrated ? itemCount : 0} items`} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-100 text-brand-900 transition-colors hover:bg-brand-50">
              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden />
              {hydrated && itemCount > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-200 px-1 text-[0.65rem] font-bold text-brand-900">{itemCount > 99 ? "99+" : itemCount}</span> : null}
            </Link>
            <button ref={toggleRef} type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-brand-900 hover:bg-brand-50 lg:hidden" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((current) => !current)}>
              {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav id="mobile-navigation" className="max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-brand-100 bg-canvas px-5 py-5 lg:hidden" aria-label="Mobile navigation">
            <div className="mx-auto grid max-w-7xl gap-1">
              {navigation.map((item) => <Link key={item.label} href={item.href} className="rounded-xl px-4 py-3 text-base font-medium text-brand-800 hover:bg-brand-50" onClick={() => setMenuOpen(false)}>{item.label}</Link>)}
              <div className="my-2 h-px bg-brand-100" />
              <Link href="/account" className="rounded-xl px-4 py-3 text-base font-medium text-brand-800 hover:bg-brand-50" onClick={() => setMenuOpen(false)}>Account &amp; orders</Link>
            </div>
          </nav>
        ) : null}
      </header>
      <main id="main-content">{children}</main>
      <footer className="bg-brand-900 text-white">
        <div className="page-container grid gap-12 py-14 sm:py-20 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="SIM.Africa home" className="inline-flex rounded-lg"><Brand inverse /></Link>
            <p className="mt-6 max-w-xs text-2xl font-medium leading-snug tracking-tight">A little less roaming.<br /><span className="editorial text-3xl text-accent-200">A lot more exploring.</span></p>
            <p className="mt-5 max-w-xs text-sm leading-6 text-brand-200">Travel eSIMs for your next African adventure. Find your destination. Stay connected.</p>
          </div>
          <div><h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-200">Explore Africa</h2><div className="mt-6 grid gap-3 text-sm text-brand-100">
            <Link className="w-fit hover:text-accent-200" href="/destinations">All destinations</Link>
            <Link className="w-fit hover:text-accent-200" href="/regional-esims">Regional eSIMs</Link>
            <Link className="w-fit hover:text-accent-200" href="/route-builder">Build your route</Link>
            <Link className="w-fit hover:text-accent-200" href="/compatibility">Device compatibility</Link>
            <Link className="w-fit hover:text-accent-200" href="/business">Business travel</Link>
            <Link className="w-fit hover:text-accent-200" href="/affiliates">Tour guide partners</Link>
          </div></div>
          <div><h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-200">Here to help</h2><div className="mt-6 grid gap-3 text-sm text-brand-100">
            <Link className="w-fit hover:text-accent-200" href="/help">Help centre</Link>
            <Link className="w-fit hover:text-accent-200" href="/help/installation">Installation guide</Link>
            <a className="inline-flex w-fit items-center gap-2 hover:text-accent-200" href="mailto:support@sim.africa">support@sim.africa <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a>
            <WhatsAppSupportLink location="footer" />
            <Link className="w-fit hover:text-accent-200" href="/refunds">Refund information</Link>
          </div></div>
        </div>
        <div className="page-container"><div className="flex flex-col justify-between gap-4 border-t border-white/15 py-6 text-xs text-brand-200 sm:flex-row"><p>© {new Date().getFullYear()} SIM.Africa. Made for the journey.</p><div className="flex gap-6"><Link className="hover:text-white" href="/privacy">Privacy policy</Link><Link className="hover:text-white" href="/terms">Terms of service</Link></div></div></div>
      </footer>
    </div>
  );
}
