import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { GuestCheckoutForm } from "@/components/checkout/GuestCheckoutForm";
import { authOptions } from "@/lib/auth/options";
import {
  buildPackageIdentifierWhere,
  getPackagePrice,
} from "@/lib/catalog/package-resolver";
import prisma from "@/lib/db/client";

export const dynamic = "force-dynamic";

type CheckoutNewPageProps = {
  searchParams: Promise<{
    packageId?: string | string[];
    quantity?: string | string[];
    intent?: string | string[];
    topUpForOrderId?: string | string[];
  }>;
};

function readSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function NewCheckoutPage({
  searchParams,
}: CheckoutNewPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedPackageId = readSearchParam(resolvedSearchParams.packageId);
  const quantity = 1;
  const intent = readSearchParam(resolvedSearchParams.intent) === "top-up" ? "top-up" : "purchase";
  const topUpForOrderId = readSearchParam(resolvedSearchParams.topUpForOrderId);

  if (!requestedPackageId) {
    return <PlanUnavailable />;
  }

  const [session, pkg] = await Promise.all([
    getServerSession(authOptions),
    prisma.package.findFirst({
      where: buildPackageIdentifierWhere(requestedPackageId, {
        activeOnly: true,
        packageType: intent === "top-up" ? "topup" : "sim",
        publicCatalogOnly: intent !== "top-up",
      }),
      include: {
        state: true,
        operator: {
          include: {
            country: true,
          },
        },
      },
    }),
  ]);

  if (!pkg) {
    return <PlanUnavailable />;
  }

  if (intent === "top-up") {
    if (!session?.user?.id || !session.user.emailProofVerified || session.user.recoveryRequired) redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/checkout/new?packageId=${requestedPackageId}&intent=top-up&topUpForOrderId=${topUpForOrderId ?? ""}`)}`);
    const ownerOrder = topUpForOrderId ? await prisma.esimOrder.findFirst({ where: { id: topUpForOrderId, userId: session.user.id, ownershipReviewRequired: false }, select: { id: true } }) : null;
    if (!ownerOrder) return <PlanUnavailable />;
  }
  const price = getPackagePrice(pkg);

  if (!price) {
    return <PlanUnavailable />;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-5 py-14 sm:px-6 lg:px-8 lg:py-16">
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">
          {intent === "top-up" ? "eSIM top-up" : "Guest checkout"}
        </p>
        <h1 className="text-4xl font-black tracking-tight text-brand-900 sm:text-5xl">
          Complete your eSIM purchase
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-brand-600">
          No account required. Enter your email, pay securely, and your eSIM
          order page will track fulfilment and show the installation details once
          supplier delivery completes.
        </p>
      </div>

      <CheckoutSummary
        packageName={pkg.title}
        packageDescription={
          pkg.shortInfo ?? pkg.operator.country.title ?? undefined
        }
        quantity={quantity}
        totalCents={price.sellingPriceCents * quantity}
        currency={price.currencyCode}
        hideTotal
        destination={pkg.operator.country.title}
        dataLabel={pkg.isUnlimited ? "Unlimited" : pkg.data}
        validityDays={pkg.day}
      />

      <GuestCheckoutForm
        packageId={pkg.id}
        defaultEmail={session?.user?.email ?? ""}
        quantity={quantity}
        intent={intent}
        topUpForOrderId={topUpForOrderId ?? undefined}
      />
    </div>
  );
}

function PlanUnavailable() {
  return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-3xl font-black text-brand-900">This plan is no longer available</h1><p className="mt-3 text-sm leading-6 text-brand-600">The package may have been removed, deactivated, repriced, or its catalogue record is no longer fresh enough to sell safely. No payment has been started.</p><Button asChild className="mt-7"><Link href="/destinations">Choose another plan</Link></Button></div>;
}
