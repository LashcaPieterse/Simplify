"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { LogoutButton } from "./LogoutButton";

const navItems = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/sync", label: "Sync Center" },
  { href: "/admin/operations", label: "Operations" },
];

export function AdminShell({ children, adminEmail }: { children: ReactNode; adminEmail: string }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-sand-50">
      <aside className="hidden w-64 border-r border-slate-200 bg-white px-4 py-6 lg:block">
        <div className="flex items-center justify-between gap-2 px-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Simplify</p>
            <p className="text-lg font-semibold text-slate-900">Admin</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-teal-50 text-teal-700" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{item.label}</span>
                {isActive ? <span className="text-xs font-semibold text-teal-700">●</span> : null}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">SIMPLIFY OPS</p>
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
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
