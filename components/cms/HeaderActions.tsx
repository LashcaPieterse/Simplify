"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSession, signOut } from "next-auth/react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/utils";

export function HeaderActions() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden h-9 w-20 animate-pulse rounded-full bg-brand-100 md:block" />
        <div className="h-10 w-24 animate-pulse rounded-full bg-brand-100" />
      </div>
    );
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
          <Link href="/auth/signin">Log in</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/auth/signup">Sign up</Link>
        </Button>
      </div>
    );
  }

  const displayName = session.user.name || session.user.email || "You";
  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
    : session.user.email?.slice(0, 2)?.toUpperCase() ?? "YO";

  return (
    <div className="relative z-20 flex items-center gap-2">
      <Button asChild size="sm" variant="secondary" className="text-brand-900">
        <Link href={"/account/esims" as Route}>My eSIMs</Link>
      </Button>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800 shadow-subtle transition hover:border-brand-300",
          open && "border-brand-300 bg-white"
        )}
        aria-expanded={open}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-200 text-brand-900">
          {initials}
        </div>
        <span className="hidden md:inline">{displayName}</span>
        <ChevronDown className="h-4 w-4 text-brand-700" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          className="absolute right-0 top-12 w-64 rounded-2xl border border-brand-100 bg-white p-2 shadow-card z-40"
        >
          <DropdownLink href={"/account/esims" as Route} label="My eSIMs / Orders" primary />
          <DropdownLink href={"/account/receipts" as Route} label="Receipts & billing" />
          <DropdownLink href={"/account/profile" as Route} label="Account & profile" />
          <DropdownLink href={"/account/payments" as Route} label="Payment methods" />
          <div className="my-2 h-px bg-brand-100" />
          <div className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">
            No eSIMs yet.{" "}
            <Link href={"/" as Route} className="font-semibold text-brand-700 hover:text-brand-900">
              Browse plans
            </Link>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DropdownLink({ href, label, primary }: { href: Route | string; label: string; primary?: boolean }) {
  return (
    <Link
      href={href as Route}
      className={cn(
        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-50",
        primary && "border border-brand-100 bg-brand-50/70 text-brand-900"
      )}
    >
      <span>{label}</span>
    </Link>
  );
}
