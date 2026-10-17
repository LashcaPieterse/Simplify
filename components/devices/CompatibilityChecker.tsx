"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Search, XCircle } from "lucide-react";

import { checkDeviceCompatibility } from "@/lib/devices/compatibility";
import { trackEvent } from "@/lib/analytics";

export function CompatibilityChecker() {
  const [query, setQuery] = useState("");
  const [checkedQuery, setCheckedQuery] = useState("");
  const result = useMemo(() => checkDeviceCompatibility(checkedQuery), [checkedQuery]);
  const Icon = result.status === "compatible" ? CheckCircle2 : result.status === "not-compatible" ? XCircle : HelpCircle;
  const styles = result.status === "compatible" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : result.status === "not-compatible" ? "border-rose-200 bg-rose-50 text-rose-950" : "border-amber-200 bg-amber-50 text-amber-950";
  const title = result.status === "compatible" ? "eSIM compatible" : result.status === "not-compatible" ? "Not eSIM compatible" : "Unable to verify";

  return (
    <div className="rounded-[2rem] border border-brand-100 bg-white p-5 shadow-card sm:p-8">
      <form onSubmit={(event) => { event.preventDefault(); const value = query.trim(); if (!value) return; setCheckedQuery(value); const checked = checkDeviceCompatibility(value); trackEvent("compatibility_check", { status: checked.status, device_family: checked.matchedFamily }); }}>
        <label htmlFor="device-model" className="text-sm font-black text-brand-900">Phone model</label>
        <div className="mt-3 flex min-h-14 items-center gap-3 rounded-2xl border border-brand-200 px-4 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100"><Search className="h-5 w-5 shrink-0 text-brand-500" aria-hidden /><input id="device-model" type="search" required value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. iPhone 15 Pro" className="min-w-0 flex-1 bg-transparent py-3 text-base text-brand-900 placeholder:text-brand-400 focus:outline-none" /><button type="submit" className="min-h-11 shrink-0 rounded-full bg-brand-700 px-5 text-sm font-black text-white hover:bg-brand-800">Check</button></div>
      </form>

      {checkedQuery ? <div className={`mt-6 rounded-2xl border p-5 ${styles}`} role="status" aria-live="polite"><div className="flex items-center gap-3"><Icon className="h-6 w-6 shrink-0" aria-hidden /><div><p className="text-xs font-bold uppercase tracking-wide opacity-75">{checkedQuery}</p><h2 className="mt-1 text-xl font-black">{title}</h2></div></div><p className="mt-4 text-sm leading-6">{result.note}</p>{result.settingsPath ? <p className="mt-3 text-sm"><strong>Check on the phone:</strong> {result.settingsPath}</p> : null}{result.sourceUrl ? <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-black underline underline-offset-4">Manufacturer documentation</a> : null}</div> : null}

      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-brand-50 p-4 text-sm leading-6 text-brand-700"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sand-600" aria-hidden /><p><strong>Your phone must generally be network/carrier unlocked.</strong> Compatibility can also vary by market, carrier firmware, and exact model number. The presence of “Add eSIM” in settings is the best on-device check.</p></div>
    </div>
  );
}
