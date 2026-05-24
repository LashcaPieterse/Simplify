import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

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
  searchParams: {
    packageId?: string | string[];
  };
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
  const requestedPackageId = readSearchParam(searchParams.packageId);

  if (!requestedPackageId) {
    notFound();
  }

  const [session, pkg] = await Promise.all([
    getServerSession(authOptions),
    prisma.package.findFirst({
      where: buildPackageIdentifierWhere(requestedPackageId, {
        activeOnly: true,
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
    notFound();
  }

  const price = getPackagePrice(pkg);

  if (!price) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Guest checkout
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Complete your eSIM purchase
        </h1>
        <p className="text-sm text-slate-600">
          No account required. Enter your email, pay securely, and your eSIM
          instructions will be available right away.
        </p>
      </div>

      <CheckoutSummary
        packageName={pkg.title}
        packageDescription={
          pkg.shortInfo ?? pkg.operator.country.title ?? undefined
        }
        quantity={1}
        totalCents={price.sellingPriceCents}
        currency={price.currencyCode}
      />

      <GuestCheckoutForm
        packageId={pkg.id}
        defaultEmail={session?.user?.email ?? ""}
      />
    </div>
  );
}
