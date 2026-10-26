"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FINANCIAL_KINDS, type ActionChoice } from "@/lib/admin/operations-types";

export type { ActionChoice } from "@/lib/admin/operations-types";
export function OperationForm({ targetId, version, actions, context }: { targetId: string; version: string; actions: ActionChoice[]; context: string }) {
  const [selected, setSelected] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ summary: string; previewVersion: string; packageId: string } | null>(null);
  const key = useRef<string | null>(null);
  const router = useRouter();
  const action = actions.find(a => a.kind === selected);
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">{actions.map(a => <div key={a.kind}><button type="button" disabled={Boolean(a.disabled) || pending} title={a.disabled} onClick={() => { setSelected(a.kind); setMessage(""); setPreview(null); key.current = null; }} className="min-h-11 rounded-xl border border-brand-100 bg-white px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50">{a.label}</button>{a.disabled ? <p className="mt-1 max-w-64 text-xs text-slate-600">{a.disabled}</p> : null}</div>)}</div>
    {action ? <form className="space-y-3 rounded-xl border border-brand-100 bg-brand-50 p-4" onSubmit={async e => {
      e.preventDefault(); if (pending) return;
      const form = new FormData(e.currentTarget);
      key.current ??= crypto.randomUUID(); setPending(true); setMessage("");
      try {
        const response = await fetch("/api/admin/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: action.kind, targetId, expectedVersion: version, idempotencyKey: key.current, reason: form.get("reason"), amount: form.get("amount") || undefined, reference: form.get("reference") || undefined, packageId: preview?.packageId ?? (form.get("packageId") || undefined), previewVersion: preview?.previewVersion, password: form.get("password") || undefined, confirmation: form.get("confirmation") === "on", duplicateCostAccepted: form.get("duplicateCostAccepted") === "on", enabled: action.enabled, outcome: form.get("outcome") || undefined }) });
        const result = await response.json();
        setMessage(`${result.message ?? "Request recorded."}${result.operationId ? ` Reference: ${result.operationId}` : ""}`);
        if (response.ok) { setSelected(""); router.refresh(); }
        else if (response.status === 400 || response.status === 409) key.current = null;
      } catch { setMessage("The response was lost. Refresh and check operation history before retrying. Retrying this form uses the same operation key."); }
      finally { setPending(false); }
    }}>
      <p className="font-semibold text-brand-900">{action.label}</p><p className="break-words text-sm text-slate-700">{context}</p><p className="text-sm text-slate-700">{action.effect}</p>
      {action.amount ? <label className="block text-sm font-medium">Amount in original payment currency<input name="amount" inputMode="decimal" required pattern="[0-9]+(\.[0-9]{1,2})?" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white p-2" /></label> : null}
      {action.reference ? <label className="block text-sm font-medium">{action.reference}<input name="reference" required maxLength={200} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white p-2" /></label> : null}
      {action.package ? <><label className="block text-sm font-medium">Replacement package ID (blank keeps the current package)<input name="packageId" maxLength={200} onChange={() => setPreview(null)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white p-2" /></label><button type="button" disabled={pending} className="min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-medium" onClick={async e => { const form = e.currentTarget.form!; setPending(true); try { const response = await fetch(`/api/admin/operations/preview?${new URLSearchParams({ targetId, packageId: String(new FormData(form).get("packageId") ?? "") })}`); const result = await response.json(); if (response.ok) { setPreview(result); setMessage(""); } else setMessage(result.message); } catch { setMessage("Preview unavailable. Refresh before confirming."); } finally { setPending(false); } }}>Preview package and supplier cost</button>{preview ? <p className="rounded-lg bg-white p-3 text-sm">{preview.summary}</p> : null}<label className="flex gap-2 text-sm"><input name="duplicateCostAccepted" type="checkbox" required />I accept the previewed package, supplier cost and possible duplicate purchase. The customer will not be charged.</label></> : null}
      {action.resolution ? <label className="block text-sm font-medium">Verified provider outcome<select name="outcome" required className="ml-2 min-h-11 rounded border p-2"><option value="confirmed">Confirmed</option><option value="rejected">Rejected / not processed</option></select></label> : null}
      <label className="block text-sm font-medium">Reason and evidence<textarea name="reason" required minLength={5} maxLength={500} rows={2} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
      {FINANCIAL_KINDS.has(action.kind) ? <label className="block text-sm font-medium">Administrator password<input type="password" name="password" required autoComplete="current-password" maxLength={1024} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white p-2" /></label> : null}
      <label className="flex gap-2 text-sm"><input name="confirmation" type="checkbox" required />I confirm the target, environment, amount where applicable, and the effect described above.</label>
      <div className="flex gap-3"><button disabled={pending || Boolean(action.package && !preview)} className="min-h-11 rounded-full bg-brand-900 px-5 py-2 font-semibold text-white disabled:opacity-50">{pending ? "Processing…" : action.label.toLowerCase().startsWith("confirm ") ? action.label : `Confirm ${action.label.toLowerCase()}`}</button><button type="button" disabled={pending} onClick={() => setSelected("")} className="min-h-11 px-3 text-sm underline">Cancel</button></div>
    </form> : null}
    {message ? <p role="status" aria-live="polite" className="break-words rounded-lg border border-brand-100 bg-white p-3 text-sm text-brand-900">{message}</p> : null}
  </div>;
}
