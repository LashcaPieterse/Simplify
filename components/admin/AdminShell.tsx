"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { ReactNode } from "react";
import { LogoutButton } from "./LogoutButton";
import { Brand } from "@/components/site/Brand";

const navItems = [
  { href: "/admin" as Route, label: "Overview" },
  { href: "/admin/packages" as Route, label: "Packages" },
  { href: "/admin/sync" as Route, label: "Sync Center" },
  { href: "/admin/sync-runs" as Route, label: "Sync Runs" },
  { href: "/admin/settings" as Route, label: "Settings" },
  { href: "/admin/operations" as Route, label: "Operations" },
  { href: "/admin/payments" as Route, label: "Payments" },
  { href: "/admin/orders" as Route, label: "Orders & delivery" },
  { href: "/admin/receipts" as Route, label: "Receipts" },
  { href: "/admin/health" as Route, label: "System health" },
  { href: "/admin/security" as Route, label: "Security" },
  { href: "/admin/audit" as Route, label: "Audit history" },
  { href: "/admin/affiliates" as Route, label: "Affiliates" },
] satisfies { href: Route; label: string }[];

export function AdminShell({ children, adminEmail }: { children: ReactNode; adminEmail: string }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-sand-50">
      <a href="#admin-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-white focus:p-3">Skip to admin content</a>
      <aside className="hidden w-64 border-r border-slate-200 bg-white px-4 py-6 lg:block">
        <div className="flex items-center justify-between gap-2 px-2">
          <div>
            <Link href="/admin" aria-label="SIM.Africa admin"><Brand /></Link>
            <p className="text-lg font-semibold text-slate-900">Admin</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-brand-900 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{item.label}</span>
                {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-accent-200" aria-hidden /> : null}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">SIM.AFRICA OPS</p>
            <p className="text-lg font-semibold text-slate-900">Airalo Partner Console</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">{adminEmail}</p>
              <p className="text-xs text-slate-500">White-label admin</p>
            </div>
            <LogoutButton />
          </div>
        </header>
        <nav aria-label="Admin navigation" className="flex flex-wrap gap-2 border-b border-brand-100 bg-white p-3 lg:hidden">{navItems.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={`min-h-11 rounded-lg px-3 py-3 text-sm font-medium ${pathname === item.href ? "bg-brand-900 text-white" : "text-brand-900 hover:bg-brand-50"}`}>{item.label}</Link>)}</nav>
        <main id="admin-content" className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
