import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AccountNav } from "@/components/account/AccountNav";
import { authOptions } from "@/lib/auth/options";

export const metadata: Metadata = {
  title: "Account | Simplify",
  description: "Manage your eSIMs, receipts, and account details.",
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent("/account/esims")}`);
  }

  const displayName = user?.name ?? user?.email ?? "Your account";

  return (
    <div className="min-h-screen bg-sand-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Account</p>
            <h1 className="text-3xl font-bold text-brand-900">{displayName}</h1>
            {user?.email ? (
              <p className="text-sm text-brand-600">Signed in as {user.email}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-6">
          <AccountNav />
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
