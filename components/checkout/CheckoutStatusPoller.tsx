"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

interface CheckoutStatusResponse {
  checkoutId: string;
  status: string;
  paymentStatus?: string;
  orderId?: string | null;
  redirectOrderId?: string | null;
  message?: string;
  isComplete?: boolean;
  fulfillmentStatus?: string;
  nextCheckAt?: string | null;
  nextReconcileAt?: string | null;
  verificationInProgress?: boolean;
}

const terminal = ["failed", "declined", "expired", "cancelled", "verification_mismatch", "creation_rejected"];
function retryAt(value: string | null) {
  if (!value) return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds) * 1000 : Date.parse(value) || 0;
}

export function CheckoutStatusPoller({ checkoutId }: { checkoutId: string }) {
  const router = useRouter();
  const [data, setData] = useState<CheckoutStatusResponse | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    setData(null);
    setDelayed(false);
    setDisconnected(false);
    let cancelled = false;
    let running = false;
    let ended = false;
    let resumeRequested = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let latest: CheckoutStatusResponse | null = null;
    let lastReconcile = -Infinity;
    let reconcileNotBefore = 0;
    let statusNotBefore = 0;
    const startedAt = Date.now();
    const controller = new AbortController();
    const active = () => navigator.onLine && document.visibilityState !== "hidden";
    const signal = () => AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);

    function consume(next: CheckoutStatusResponse) {
      if (cancelled) return;
      latest = next;
      setData(next);
      const paymentStatus = (next.paymentStatus ?? next.status).toLowerCase();
      const target = next.redirectOrderId ?? next.orderId;
      if (next.isComplete && target) {
        ended = true;
        const key = `sim-africa-purchase-${checkoutId}`;
        try {
          if (!window.sessionStorage.getItem(key)) {
            trackEvent("purchase_completed", { checkout_id: checkoutId, order_id: target });
            window.sessionStorage.setItem(key, "1");
          }
        } catch { /* Optional analytics cannot prevent a completed redirect. */ }
        router.replace(`/orders/${target}`);
      } else if (["failed", "declined", "expired", "cancelled", "creation_rejected"].includes(paymentStatus)) {
        ended = true;
        trackEvent("purchase_failed", { checkout_id: checkoutId });
        router.replace(`/checkout/${checkoutId}/failed`);
      }
    }

    async function poll() {
      if (cancelled || ended || running || !active()) return;
      running = true;
      resumeRequested = false;
      const recent = Date.now() - startedAt < 120_000;
      const interval = recent ? 2000 : 10_000;
      try {
        const paymentStatus = (latest?.paymentStatus ?? latest?.status ?? "pending").toLowerCase();
        const serverEligible = latest?.nextReconcileAt ? Date.parse(latest.nextReconcileAt) : 0;
        const canReconcile = !terminal.includes(paymentStatus) && latest?.nextReconcileAt !== null && !latest?.verificationInProgress;
        if (canReconcile && Date.now() >= Math.max(reconcileNotBefore, serverEligible || 0, lastReconcile + (recent ? 15_000 : 60_000))) {
          lastReconcile = Date.now();
          try {
            const response = await fetch(`/api/checkouts/${checkoutId}/reconcile`, { method: "POST", signal: signal() });
            reconcileNotBefore = Math.max(reconcileNotBefore, retryAt(response.headers.get("Retry-After")));
            if (response.ok) consume(await response.json());
          } catch { /* GET status and durable backend work remain independent. */ }
        }
        if (!ended && !cancelled && Date.now() >= statusNotBefore) {
          const response = await fetch(`/api/checkouts/${checkoutId}/status`, { cache: "no-store", signal: signal() });
          statusNotBefore = Math.max(statusNotBefore, retryAt(response.headers.get("Retry-After")));
          if (!response.ok) throw new Error("Status temporarily unavailable");
          consume(await response.json());
          if (!cancelled) setDisconnected(false);
        }
      } catch {
        if (!cancelled) {
          setDisconnected(true);
          statusNotBefore = Math.max(statusNotBefore, Date.now() + interval * 2);
        }
      } finally {
        running = false;
        if (!cancelled && !ended) {
          setDelayed(Date.now() - startedAt >= 120_000);
          if (active()) timeout = setTimeout(poll, resumeRequested ? 0 : interval);
        }
      }
    }

    function resume() {
      if (timeout) clearTimeout(timeout);
      if (!active()) {
        if (!navigator.onLine) setDisconnected(true);
        return;
      }
      if (running) resumeRequested = true;
      else void poll();
    }
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    document.addEventListener("visibilitychange", resume);
    if (!navigator.onLine) setDisconnected(true);
    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      if (timeout) clearTimeout(timeout);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [checkoutId, router]);

  const status = (data?.paymentStatus ?? data?.status ?? "pending").toLowerCase();
  const approved = status === "approved" || status === "paid";
  const review = status === "verification_mismatch";
  const title = data?.isComplete ? "Your order is ready" : approved ? "Payment confirmed" : review ? "Payment needs review" : status === "authorized" ? "Payment authorized" : delayed ? "Still checking your payment" : "Checking your payment";
  const message = disconnected ? "Connection interrupted. Your checkout is saved and processing can continue. We’ll update automatically when you reconnect."
    : review ? "Please contact support before paying again."
    : data?.message ?? (data?.isComplete ? "Opening your order…" : approved ? "Preparing your order and setup details…" : delayed ? "Confirmation is taking longer than usual. Your checkout is saved; please do not pay again." : "We’re confirming the payment provider’s response. Please do not pay again.");
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <p className="text-sm font-semibold text-brand-600">{title}</p>
      <p className="text-xs text-brand-500">{message}</p>
    </div>
  );
}
