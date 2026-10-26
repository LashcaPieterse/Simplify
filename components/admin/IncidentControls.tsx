"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function IncidentControls({ incidentId }: { incidentId?: string }) {
  const [pending, setPending] = useState(false); const [message, setMessage] = useState(""); const router = useRouter();
  return <form className="space-y-3" onSubmit={async e => {
    e.preventDefault(); if (pending) return; const form = new FormData(e.currentTarget); setPending(true);
    try { const response = await fetch("/api/admin/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: incidentId ? form.get("action") : "refresh", incidentId, note: form.get("note") || undefined, reference: form.get("reference") || undefined }) }); const result = await response.json(); setMessage(result.message); if (response.ok) router.refresh(); }
    catch { setMessage("The request could not be confirmed. Refresh to check incident history."); } finally { setPending(false); }
  }}>
    {incidentId ? <><label className="block text-sm">Review action<select name="action" className="ml-3 min-h-11 rounded border bg-white p-2"><option value="acknowledge">Acknowledge</option><option value="note">Add note</option><option value="escalate">Escalate</option></select></label><label className="block text-sm">Note<textarea name="note" required maxLength={500} className="mt-1 block w-full rounded border bg-white p-2" /></label><label className="block text-sm">Escalation reference (required when escalating)<input name="reference" maxLength={200} className="mt-1 block min-h-11 w-full rounded border bg-white p-2" /></label></> : null}
    <button disabled={pending} className="min-h-11 rounded-full border border-brand-900 px-4 py-2 text-sm font-semibold text-brand-900 disabled:opacity-50">{pending ? "Checking…" : incidentId ? "Record review" : "Recheck incident conditions"}</button>{message ? <p role="status" className="text-sm text-brand-900">{message}</p> : null}
  </form>;
}
