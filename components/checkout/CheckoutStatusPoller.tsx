"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 3000;

interface CheckoutStatusPollerProps {
  checkoutId: string;
}

interface CheckoutStatusResponse {
  checkoutId: string;
  status: string;
  paymentStatus?: string;
  orderId?: string | null;
  paymentUrl?: string;
  message?: string;
}

export function CheckoutStatusPoller({ checkoutId }: CheckoutStatusPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("pending");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

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

        setStatus(data.paymentStatus ?? data.status ?? "pending");
        if (data.message) {
          setMessage(data.message);
        }

        if (data.orderId) {
          router.replace(`/orders/${data.orderId}`);
          return;
        }

        if ((data.paymentStatus ?? "").toLowerCase() === "failed") {
          router.replace(`/checkout/${checkoutId}/failed`);
          return;
        }

        // If payment is approved but no orderId yet and we have a message, stop polling and show it.
        if ((data.paymentStatus ?? "").toLowerCase() === "approved" && !data.orderId && data.message) {
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
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [checkoutId, router]);

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">Processing your payment…</p>
      <p className="text-xs text-slate-500">Current status: {status}</p>
      {message ? <p className="text-xs text-red-600">{message}</p> : null}
    </div>
  );
}
