"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AffiliateForm({ endpoint, children, label, className = "space-y-4" }: { endpoint: string; children: ReactNode; label: string; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    setPending(true); setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      setFailed(!response.ok);
      setMessage(data.message ?? (response.ok ? "Saved." : "Unable to save. Please try again."));
      if (response.ok) router.refresh();
    } catch { setFailed(true); setMessage("Unable to connect. Please try again."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className={className}><fieldset disabled={pending} className="space-y-4">{children}</fieldset><Button type="submit" disabled={pending}>{pending ? "Saving…" : label}</Button>{message ? <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-rose-700" : "text-brand-700"}`}>{message}</p> : null}</form>;
}
