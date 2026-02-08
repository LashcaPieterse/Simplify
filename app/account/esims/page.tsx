import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import prisma from "@/lib/db/client";
import { authOptions } from "@/lib/auth/options";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export default async function AccountEsimsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent("/account/esims")}`);
  }

  const orders = await prisma.esimOrder.findMany({
    where: { userId },
    include: {
      profiles: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-200 bg-white/80 p-8 text-center shadow-sm">
        <h2 className="text-2xl font-semibold text-brand-900">No eSIMs yet</h2>
        <p className="mt-2 text-sm text-brand-600">
          Start with a destination plan and your new eSIMs will appear here.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm"
        >
          Browse plans
        </Link>
      </div>
    );
  }

  const packageIds = Array.from(new Set(orders.map((order) => order.packageId)));
  const packageUuidIds = packageIds.filter((id) => UUID_REGEX.test(id));
  const packageExternalIds = packageIds.filter((id) => !UUID_REGEX.test(id));

  const packages = packageIds.length
    ? await prisma.package.findMany({
        where: {
          OR: [
            packageUuidIds.length ? { id: { in: packageUuidIds } } : undefined,
            packageExternalIds.length ? { externalId: { in: packageExternalIds } } : undefined,
          ].filter(Boolean) as Prisma.PackageWhereInput[],
        },
        include: { country: true },
      })
    : [];

  const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]));
  const packageByExternalId = new Map(packages.map((pkg) => [pkg.externalId, pkg]));

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const pkg = packageById.get(order.packageId) ?? packageByExternalId.get(order.packageId);
        const profile = order.profiles[0] ?? null;
        const hasTotal = order.totalCents !== null && order.totalCents !== undefined && Boolean(order.currency);
        const totalLabel = hasTotal && order.currency
          ? formatCurrency(order.totalCents ?? 0, order.currency)
          : "Pending";

        return (
          <div
            key={order.id}
            className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">
                  {pkg?.country?.name ?? "eSIM"}
                </p>
                <h2 className="text-lg font-semibold text-brand-900">
                  {pkg?.name ?? "Simplify eSIM plan"}
                </h2>
                <p className="mt-1 text-sm text-brand-600">
                  Order reference {order.orderNumber ?? order.requestId ?? order.id}
                </p>
                <p className="text-xs text-brand-500">Placed {formatDate(order.createdAt)}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-500">Status</p>
                <p className="text-base font-semibold text-brand-900">{order.status}</p>
                <p className="text-sm text-brand-600">{totalLabel}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-brand-600">
              {profile?.iccid ? (
                <span>ICCID: {profile.iccid}</span>
              ) : (
                <span>eSIM provisioning in progress</span>
              )}
              <Link
                href={`/orders/${order.id}`}
                className="font-semibold text-teal-700 hover:text-teal-600"
              >
                View order
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
