import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ensureOrderInstallation, OrderServiceError } from "@/lib/orders/service";
import { pollUsageForProfile } from "@/lib/orders/usage";
import { getTopUpPackages } from "@/lib/orders/topups";
import { createCheckout } from "@/lib/payments/checkouts";
import { redirect } from "next/navigation";
import InstallationInstructions from "@/components/esim/InstallationInstructions";

type OrderPageParams = {
  params: {
    orderId: string;
  };
};

function formatDataAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} GB`;
  }

  return `${value.toFixed(2)} MB`;
}

function formatCurrency(amount: number | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
    }).format(amount / 100);
  } catch {
    return `${amount / 100} ${currency ?? "USD"}`;
  }
}

async function purchaseTopUp(
  orderIdentifier: string,
  profileIccid: string | null,
  customerEmail: string | null,
  formData: FormData,
): Promise<void> {
  "use server";

  const packageId = formData.get("packageId");

  if (typeof packageId !== "string" || packageId.length === 0) {
    throw new OrderServiceError("A package selection is required to purchase a top-up.", 422);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const checkout = await createCheckout(
    {
      packageId,
      quantity: 1,
      customerEmail: customerEmail ?? undefined,
      intent: "top-up",
      topUpForOrderId: orderIdentifier,
      topUpForIccid: profileIccid ?? undefined,
    },
    { baseUrl },
  );

  redirect(`/checkout/${checkout.checkoutId}`);
}

function parseInstallationPayload(payload: string | null): Record<string, unknown> | null {
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload);
  } catch (error) {
    console.error("Failed to parse installation payload", error);
    return null;
  }
}

export const metadata: Metadata = {
  title: "Order dashboard",
};

export default async function OrderPage({ params }: OrderPageParams) {
  const identifier = decodeURIComponent(params.orderId);
  const order = await ensureOrderInstallation(identifier);

  if (!order) {
    notFound();
  }
  const profile = order.profiles[0] ?? null;

  const usageResult = profile ? await pollUsageForProfile(order.id, profile) : null;
  const topUpPackages = profile?.iccid ? await getTopUpPackages(profile.iccid) : [];
  const installationPayload = parseInstallationPayload(order.installation?.payload ?? null);

  const purchaseAction = purchaseTopUp.bind(
    null,
    order.id,
    profile?.iccid ?? null,
    order.customerEmail ?? null,
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-12">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-sand-500">Order</p>
        <h1 className="text-3xl font-semibold text-brand-900">
          {order.package?.name ?? "eSIM order"}
        </h1>
        <div className="text-sm text-sand-600">
          <p>
            Order reference:{" "}
            {order.orderNumber ? (
              <span>{order.orderNumber}</span>
            ) : (
              <span className="text-sand-500">Awaiting Airalo confirmation</span>
            )}
          </p>
          {order.requestId ? <p>Airalo request ID: {order.requestId}</p> : null}
          <p>Status: {order.status}</p>
          {order.totalCents !== null && order.currency ? (
            <p>Total paid: {formatCurrency(order.totalCents, order.currency)}</p>
          ) : null}
          {order.customerEmail ? <p>Customer email: {order.customerEmail}</p> : null}
        </div>
      </header>

      {order.payment ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sand-200">
          <h2 className="text-xl font-semibold text-brand-900">Payment receipt</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-sand-500">Provider</dt>
              <dd className="text-base font-semibold text-brand-900">{order.payment.provider.toUpperCase()}</dd>
            </div>
            <div>
              <dt className="text-sm text-sand-500">Status</dt>
              <dd className="text-base font-semibold text-brand-900">{order.payment.status}</dd>
            </div>
            {order.payment.providerReference ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-sand-500">Transaction reference</dt>
                <dd className="text-base font-medium text-brand-900">{order.payment.providerReference}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm text-sand-500">Amount captured</dt>
              <dd className="text-base font-semibold text-brand-900">
                {formatCurrency(order.payment.amountCents, order.payment.currency)}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sand-200">
        <h2 className="text-xl font-semibold text-brand-900">eSIM profile</h2>
        {profile ? (
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-sand-500">ICCID</dt>
              <dd className="font-medium text-brand-900">{profile.iccid}</dd>
            </div>
            <div>
              <dt className="text-sm text-sand-500">Status</dt>
              <dd className="font-medium text-brand-900">{profile.status}</dd>
            </div>
            {profile.activationCode ? (
              <div>
                <dt className="text-sm text-sand-500">Activation code</dt>
                <dd className="font-medium text-brand-900">{profile.activationCode}</dd>
              </div>
            ) : null}
            {installationPayload && typeof installationPayload.qrCode === "string" ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-sand-500">QR code URL</dt>
                <dd>
                  <a
                    href={installationPayload.qrCode as string}
                    className="text-teal-600 underline-offset-2 hover:underline"
                  >
                    View QR code
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-sand-600">
            We&apos;re preparing your eSIM profile. Check back soon for installation details.
          </p>
        )}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sand-200">
        <h2 className="text-xl font-semibold text-brand-900">Installation instructions</h2>
        <InstallationInstructions iccid={profile?.iccid ?? null} className="mt-4" />
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sand-200">
        <h2 className="text-xl font-semibold text-brand-900">Data usage</h2>
        {usageResult?.snapshot ? (
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-sand-500">Used</dt>
              <dd className="text-lg font-semibold text-brand-900">
                {formatDataAmount(usageResult.snapshot.usedMb)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-sand-500">Remaining</dt>
              <dd className="text-lg font-semibold text-brand-900">
                {formatDataAmount(usageResult.snapshot.remainingMb)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-sand-500">Last updated</dt>
              <dd className="text-lg font-semibold text-brand-900">
                {usageResult.snapshot.recordedAt.toLocaleString()}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-sand-600">
            Usage information isn&apos;t available yet. We&apos;ll refresh it as soon as the SIM is
            active.
          </p>
        )}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sand-200">
        <h2 className="text-xl font-semibold text-brand-900">Top-up options</h2>
        {profile?.iccid ? (
          topUpPackages.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {topUpPackages.map((pkg) => (
                <form
                  key={pkg.id}
                  action={purchaseAction}
                  className="flex h-full flex-col justify-between rounded-2xl border border-sand-200 p-4"
                >
                  <input type="hidden" name="packageId" value={pkg.localPackageId} />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-brand-900">{pkg.name}</p>
                    <p className="text-sm text-sand-600">{pkg.destination_name ?? pkg.destination}</p>
                    {pkg.data_amount ? (
                      <p className="text-sm text-sand-500">Allowance: {pkg.data_amount}</p>
                    ) : null}
                    <p className="text-sm font-medium text-brand-900">
                      {formatCurrency(Math.round(pkg.price * 100), pkg.currency)}
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="mt-4 inline-flex items-center justify-center rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    Purchase top-up
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-sand-600">
              No top-up packages are currently available for this eSIM. Please check again later.
            </p>
          )
        ) : (
          <p className="mt-4 text-sm text-sand-600">
            Top-up options will appear once the eSIM profile is assigned to this order.
          </p>
        )}
      </section>
    </div>
  );
}
