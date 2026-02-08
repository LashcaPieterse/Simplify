"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/utils";

const NAV_ITEMS = [
  { href: "/account/esims", label: "My eSIMs" },
  { href: "/account/receipts", label: "Receipts" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/payments", label: "Payments" },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-brand-100 bg-white/80 p-2 shadow-sm">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              isActive
                ? "bg-brand-900 text-white"
                : "text-brand-700 hover:bg-brand-50"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
