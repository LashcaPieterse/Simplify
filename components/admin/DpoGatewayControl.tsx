"use client";

import { useState, useTransition } from "react";
import type { DpoMode } from "@prisma/client";
import { setDpoMode } from "@/app/(admin)/admin/dpo-actions";

export function DpoGatewayControl({ activeMode, configured }: { activeMode: DpoMode; configured: Record<DpoMode, boolean> }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const targetMode = activeMode === "test" ? "live" : "test";

  return (
    <section aria-labelledby="dpo-gateway-heading" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="dpo-gateway-heading" className="text-sm font-semibold text-slate-900">DPO payment gateway</h2>
          <p className="mt-1 text-sm text-slate-600">Applies to all new purchases and top-ups. Payments already started keep their original gateway.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeMode === "live" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          {activeMode === "live" ? "Live payments active" : "Test payments active"}
        </span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600" aria-label="DPO credentials">
        <li>Test credentials: {configured.test ? "Configured" : "Not configured"}</li>
        <li>Live credentials: {configured.live ? "Configured" : "Not configured"}</li>
      </ul>
      <p className="mt-2 text-xs text-slate-500">Approved test payments still create Airalo orders and can incur supplier charges.</p>
      {!configured[activeMode] ? <p className="mt-2 text-sm text-rose-700" role="alert">Active gateway credentials are incomplete. New payments cannot be created.</p> : null}
      <div className="mt-3 space-y-2">
        <button
          type="button"
          disabled={isPending || !configured[targetMode]}
          onClick={() => {
            setFeedback(null);
            startTransition(async () => {
              try {
                setFeedback(await setDpoMode(targetMode));
              } catch {
                setFeedback({ ok: false, message: "Unable to change DPO mode. Refresh and try again." });
              }
            });
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Switching gateway..." : `Switch to ${targetMode}`}
        </button>
        {!configured[targetMode] ? <p className="text-xs text-slate-600">Configure the {targetMode} credentials in server secrets to enable switching.</p> : null}
        {feedback ? <p role={feedback.ok ? "status" : "alert"} className={`text-sm ${feedback.ok ? "text-emerald-700" : "text-rose-700"}`}>{feedback.message}</p> : null}
      </div>
    </section>
  );
}
