import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Route } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import {
  ensureOrderInstallation,
  getOrderWithDetails,
  OrderServiceError,
  type OrderWithDetails,
} from "@/lib/orders/service";
import prisma from "@/lib/db/client";
import { pollUsageForProfile } from "@/lib/orders/usage";
import { getTopUpPackages } from "@/lib/orders/topups";
import { createCheckout } from "@/lib/payments/checkouts";
import { authOptions } from "@/lib/auth/options";
import { getServerSession } from "next-auth";
import InstallationInstructions from "@/components/esim/InstallationInstructions";
import { WhatsAppSupportLink } from "@/components/site/WhatsAppSupportLink";
import { findPackageDisplayByIdentifier } from "@/lib/catalog/package-resolver";
import { formatCurrency } from "@/lib/format";
import {
  canAccessOwnerScopedRecord,
  canIssueScopedAccessTokens,
  canStartTopUpCheckout,
  hasScopedAccessFromCookieStore,
  setScopedAccessCookie,
  type SessionLike,
} from "@/lib/orders/access";
import { normalizeHttpUrl } from "@/lib/http/safe-url";

type OrderPageParams = {
  params: Promise<{
    orderId: string;
  }>;
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

function formatOptionalDate(value: Date | null | undefined): string {
  return value ? value.toLocaleString() : "Not set";
}

function formatCounter(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

function hasUsageCounter(
  remaining: number | null | undefined,
  total: number | null | undefined,
): boolean {
  return (
    (typeof remaining === "number" && remaining > 0) ||
    (typeof total === "number" && total > 0)
  );
}

async function canAccessOrder(order: OrderWithDetails, session: SessionLike): Promise<boolean> {
  const cookieStore = await cookies();
  return canAccessOwnerScopedRecord(
    order,
    session,
    hasScopedAccessFromCookieStore(cookieStore, "order", order.id),
  );
}

async function purchaseTopUp(
  orderIdentifier: string,
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
  const session = await getServerSession(authOptions);
  const order = await getOrderWithDetails(orderIdentifier);

  if (!order) {
    notFound();
  }

  if (!session?.user?.id) {
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/orders/${order.id}`)}`,
    );
  }

  if (!canStartTopUpCheckout(order, session)) {
    notFound();
  }

  const profileIccid = order.profiles[0]?.iccid ?? null;

  const checkout = await createCheckout(
    {
      packageId,
      quantity: 1,
      customerEmail: order.customerEmail ?? session?.user?.email ?? undefined,
      intent: "top-up",
      topUpForOrderId: order.id,
      topUpForIccid: profileIccid ?? undefined,
    },
    { baseUrl, userId: session?.user?.id },
  );

  if (canIssueScopedAccessTokens()) {
    const cookieStore = await cookies();
    setScopedAccessCookie(cookieStore, "checkout", checkout.checkoutId);
  }

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

function readPayloadString(
  payload: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveQrCodeUrl(
  payload: Record<string, unknown> | null,
): string | null {
  const qrCodeUrl = readPayloadString(payload, "qrCodeUrl");
  const safeQrCodeUrl = normalizeHttpUrl(qrCodeUrl);
  if (safeQrCodeUrl) return safeQrCodeUrl;

  const legacyQrCode = readPayloadString(payload, "qrCode");
  return normalizeHttpUrl(legacyQrCode);
}

export const metadata: Metadata = {
  title: "Order dashboard",
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }: OrderPageParams) {
  const { orderId } = await params;
  const identifier = decodeURIComponent(orderId);
  const session = await getServerSession(authOptions);
  const existingOrder = await getOrderWithDetails(identifier);

  if (!existingOrder) {
    notFound();
  }

  if (!(await canAccessOrder(existingOrder, session))) {
    if (!session?.user?.id) {
      redirect(
        `/auth/signin?callbackUrl=${encodeURIComponent(`/orders/${orderId}`)}`,
      );
    }

    notFound();
  }

  const order = await ensureOrderInstallation(existingOrder.id);

  if (!order) {
    notFound();
  }

  const pkg = await findPackageDisplayByIdentifier(prisma, order.packageId);
  const profile = order.profiles[0] ?? null;

  const usageResult = profile ? await pollUsageForProfile(order.id, profile) : null;
  const usageSnapshot = usageResult?.snapshot ?? null;
  const usageStatus = usageSnapshot?.status ?? null;
  const isRecycledUsage = usageStatus?.toUpperCase() === "RECYCLED";
  const shouldShowFiniteDataUsage =
    Boolean(usageSnapshot) &&
    usageSnapshot?.isUnlimited !== true &&
    !isRecycledUsage &&
    (usageSnapshot?.usedMb !== null ||
      usageSnapshot?.remainingMb !== null ||
      usageSnapshot?.totalMb !== null);
  const hasVoiceUsage = hasUsageCounter(
    usageSnapshot?.remainingVoiceMinutes,
    usageSnapshot?.totalVoiceMinutes,
  );
  const hasTextUsage = hasUsageCounter(
    usageSnapshot?.remainingTextMessages,
    usageSnapshot?.totalTextMessages,
  );
  const topUpPackages = profile?.iccid ? await getTopUpPackages(profile.iccid) : [];
  const installationPayload = parseInstallationPayload(order.installation?.payload ?? null);
  const qrCodeUrl = resolveQrCodeUrl(installationPayload);
  const qrCodeData = readPayloadString(installationPayload, "qrCodeData");
  const showSaveAccountPrompt = !order.userId && Boolean(order.customerEmail);
  const saveAccountHref = order.customerEmail
    ? `/auth/signin?callbackUrl=${encodeURIComponent(`/orders/${order.id}`)}&email=${encodeURIComponent(order.customerEmail)}&method=email`
    : "/auth/signin";

  const purchaseAction = purchaseTopUp.bind(
    null,
    order.id,
  );
  const orderReady = Boolean(profile && (qrCodeUrl || qrCodeData || profile.activationCode));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-12">
      <header className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-600">Order confirmation</p>
        <h1 className="text-3xl font-semibold text-brand-900">
          {orderReady ? "Your eSIM is ready" : "We’re preparing your eSIM"}
        </h1>
        <p className="text-lg font-semibold text-brand-700">{pkg?.title ?? "eSIM order"}</p>
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
          {pkg ? <p>{pkg.isUnlimited ? "Unlimited data" : pkg.data} · {pkg.day} days · {pkg.operator.country.title}</p> : null}
        </div>
      </header>

      <section className="rounded-3xl border border-brand-100 bg-brand-50 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-brand-900">What happens next</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          <li className="rounded-2xl bg-white p-4"><span className="text-xs font-black uppercase tracking-wide text-brand-500">Step 1</span><h3 className="mt-2 font-bold text-brand-900">Check your email</h3><p className="mt-2 text-sm leading-6 text-brand-600">Keep this secure page. A transactional email is sent when delivery is configured.</p></li>
          <li className="rounded-2xl bg-white p-4"><span className="text-xs font-black uppercase tracking-wide text-brand-500">Step 2</span><h3 className="mt-2 font-bold text-brand-900">Install carefully</h3><p className="mt-2 text-sm leading-6 text-brand-600">Use the QR or manual instructions below and do not delete the eSIM prematurely.</p></li>
          <li className="rounded-2xl bg-white p-4"><span className="text-xs font-black uppercase tracking-wide text-brand-500">Step 3</span><h3 className="mt-2 font-bold text-brand-900">Follow activation rules</h3><p className="mt-2 text-sm leading-6 text-brand-600">{pkg?.operator.activationPolicy?.trim() || "No catalogue activation policy was provided. Contact support before installing if the order instructions are unclear."}</p></li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-3"><Link href="/help/installation" className="button-ribbon-primary inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold">View installation guide</Link><a href="mailto:support@sim.africa" className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-200 bg-white px-5 text-sm font-semibold text-brand-800">Email support</a><WhatsAppSupportLink location="order" showIcon className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-200 bg-white px-5 text-sm font-semibold text-brand-800" /></div>
      </section>

      {showSaveAccountPrompt ? (
        <section className="rounded-3xl bg-teal-50 p-6 shadow-sm ring-1 ring-teal-100">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-brand-900">
                Save this eSIM for easier top-ups and support.
              </h2>
              <p className="mt-1 text-sm text-brand-700">
                Verify {order.customerEmail} to keep this order with your account.
              </p>
            </div>
            <Link
              href={saveAccountHref as Route}
              className="button-ribbon-primary inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold focus:outline-none"
            >
              Save this eSIM
            </Link>
          </div>
        </section>
      ) : null}

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
            {qrCodeUrl ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-sand-500">QR code URL</dt>
                <dd>
                  <a
                    href={qrCodeUrl}
                    className="text-teal-600 underline-offset-2 hover:underline"
                  >
                    View QR code
                  </a>
                </dd>
              </div>
            ) : null}
            {qrCodeData ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-sand-500">QR code data</dt>
                <dd className="break-all font-mono text-sm text-brand-900">{qrCodeData}</dd>
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
        {usageSnapshot ? (
          <div className="mt-4 space-y-4">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-sand-500">Status</dt>
                <dd className="text-lg font-semibold text-brand-900">
                  {usageStatus ?? "Unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-sand-500">Expires</dt>
                <dd className="text-lg font-semibold text-brand-900">
                  {formatOptionalDate(usageSnapshot.expiredAt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-sand-500">Last updated</dt>
                <dd className="text-lg font-semibold text-brand-900">
                  {usageSnapshot.recordedAt.toLocaleString()}
                </dd>
              </div>
            </dl>

            {isRecycledUsage ? (
              <p className="rounded-2xl bg-sand-50 p-4 text-sm text-sand-600">
                Airalo marks this SIM as recycled, so usage counters are no longer shown.
              </p>
            ) : usageSnapshot.isUnlimited ? (
              <p className="rounded-2xl bg-sand-50 p-4 text-sm text-sand-600">
                This is an unlimited data package. Airalo reports data counters as zero for
                unlimited plans, so finite usage is not shown.
              </p>
            ) : shouldShowFiniteDataUsage ? (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-sand-500">Used</dt>
                  <dd className="text-lg font-semibold text-brand-900">
                    {formatDataAmount(usageSnapshot.usedMb)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-sand-500">Remaining</dt>
                  <dd className="text-lg font-semibold text-brand-900">
                    {formatDataAmount(usageSnapshot.remainingMb)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-sand-500">Total</dt>
                  <dd className="text-lg font-semibold text-brand-900">
                    {formatDataAmount(usageSnapshot.totalMb)}
                  </dd>
                </div>
              </dl>
            ) : null}

            {hasVoiceUsage || hasTextUsage ? (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {hasVoiceUsage ? (
                  <div>
                    <dt className="text-sm text-sand-500">Voice minutes</dt>
                    <dd className="text-lg font-semibold text-brand-900">
                      {formatCounter(usageSnapshot.remainingVoiceMinutes)} remaining of{" "}
                      {formatCounter(usageSnapshot.totalVoiceMinutes)}
                    </dd>
                  </div>
                ) : null}
                {hasTextUsage ? (
                  <div>
                    <dt className="text-sm text-sand-500">Text messages</dt>
                    <dd className="text-lg font-semibold text-brand-900">
                      {formatCounter(usageSnapshot.remainingTextMessages)} remaining of{" "}
                      {formatCounter(usageSnapshot.totalTextMessages)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
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
                    <p className="text-lg font-semibold text-brand-900">{pkg.title}</p>
                    {pkg.short_info ? (
                      <p className="text-sm text-sand-600">{pkg.short_info}</p>
                    ) : null}
                    <p className="text-sm text-sand-500">
                      Data: {pkg.is_unlimited ? "Unlimited" : pkg.data}
                    </p>
                    <p className="text-sm text-sand-500">Validity: {pkg.day} days</p>
                    {pkg.voice > 0 || pkg.text > 0 ? (
                      <p className="text-sm text-sand-500">
                        {pkg.voice > 0 ? `${pkg.voice} mins` : null}
                        {pkg.voice > 0 && pkg.text > 0 ? " · " : null}
                        {pkg.text > 0 ? `${pkg.text} SMS` : null}
                      </p>
                    ) : null}
                    <p className="text-sm font-medium text-brand-900">
                      {formatCurrency(Math.round(pkg.price * 100), pkg.currency)}
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="button-ribbon-primary mt-4 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold focus:outline-none"
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
