"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

const POLL_INTERVAL_MS = 3000;

interface CheckoutStatusPollerProps {
  checkoutId: string;
}

interface CheckoutStatusResponse {
  checkoutId: string;
  status: string;
  paymentStatus?: string;
  orderId?: string | null;
  redirectOrderId?: string | null;
  paymentUrl?: string;
  message?: string;
  isComplete?: boolean;
  fulfillmentStatus?: string;
  nextCheckAt?: string | null;
}

export function CheckoutStatusPoller({ checkoutId }: CheckoutStatusPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("pending");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    void fetch(`/api/checkouts/${checkoutId}/reconcile`, { method: "POST", signal: controller.signal }).catch(() => {});

    async function poll() {
      try {
        const response = await fetch(`/api/checkouts/${checkoutId}/status`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to check payment status");
        }

        const data = (await response.json()) as CheckoutStatusResponse;

        if (cancelled) {
          return;
        }

        const nextStatus = data.paymentStatus ?? data.status ?? "pending";
        setStatus(nextStatus);
        if (nextStatus.toLowerCase() === "approved") {
          setMessage(null);
        } else if (data.message) {
          setMessage(data.message);
        }

        const redirectOrderId = data.redirectOrderId ?? data.orderId;
        if (data.isComplete && redirectOrderId) {
          const eventKey = `sim-africa-purchase-${checkoutId}`;
          try { if (!window.sessionStorage.getItem(eventKey)) {
            trackEvent("purchase_completed", { checkout_id: checkoutId, order_id: redirectOrderId });
            window.sessionStorage.setItem(eventKey, "1");
          } } catch { /* Storage availability must not prevent a completed redirect. */ }
          router.replace(`/orders/${redirectOrderId}`);
          return;
        }

        if (["failed", "declined", "expired", "cancelled"].includes((data.paymentStatus ?? "").toLowerCase())) {
          trackEvent("purchase_failed", { checkout_id: checkoutId });
          router.replace(`/checkout/${checkoutId}/failed`);
          return;
        }

        // If payment is approved but no orderId yet and we have a message, stop polling and show it.
        if ((data.paymentStatus ?? "").toLowerCase() === "verification_mismatch") {
          setMessage("This payment needs review. Contact support before paying again.");
          return;
        }

        timeout = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : String(error));
          timeout = setTimeout(poll, POLL_INTERVAL_MS * 2);
        }
      }
    }

    poll();

    return () => {
      cancelled = true;
      controller.abort();
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [checkoutId, router]);

  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <p className="text-sm text-brand-600">Processing your payment…</p>
      <p className="text-xs text-brand-500">Current status: {status}</p>
      {message ? <p className="text-xs font-semibold text-rose-700">{message}</p> : null}
    </div>
  );
}
