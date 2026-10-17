"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

const fields = [
  { name: "companyName", label: "Company name", type: "text", autoComplete: "organization" },
  { name: "contactName", label: "Contact name", type: "text", autoComplete: "name" },
  { name: "email", label: "Work email", type: "email", autoComplete: "email" },
  { name: "travellersPerMonth", label: "Travellers per month", type: "number", autoComplete: "off" },
] as const;

export function BusinessLeadForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/business-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "The enquiry could not be sent.");
      setStatus("sent");
      form.reset();
      trackEvent("business_lead_submitted");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The enquiry could not be sent.");
      setStatus("idle");
    }
  }

  if (status === "sent") return <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-950" role="status"><CheckCircle2 className="h-7 w-7" aria-hidden /><h2 className="mt-4 text-xl font-black">Enquiry sent</h2><p className="mt-2 text-sm leading-6">SIM.Africa has received your business travel requirements.</p></div>;

  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-brand-100 bg-white p-5 shadow-card sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => <label key={field.name} className="text-sm font-bold text-brand-900">{field.label}<input name={field.name} type={field.type} autoComplete={field.autoComplete} required min={field.type === "number" ? 1 : undefined} max={field.type === "number" ? 10000 : undefined} className="mt-2 h-12 w-full rounded-xl border border-brand-200 px-3 text-base font-normal focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" /></label>)}
      </div>
      <label className="mt-5 block text-sm font-bold text-brand-900">Countries frequently visited<input name="countries" type="text" required placeholder="e.g. Kenya, Namibia, South Africa" className="mt-2 h-12 w-full rounded-xl border border-brand-200 px-3 text-base font-normal focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" /></label>
      <label className="mt-5 block text-sm font-bold text-brand-900">Message<textarea name="message" required rows={5} className="mt-2 w-full rounded-xl border border-brand-200 p-3 text-base font-normal focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" placeholder="Tell us about trip frequency, plan sizes, billing needs, or support requirements." /></label>
      <label className="sr-only">Leave this field empty<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      <p className="mt-4 text-xs leading-5 text-brand-500">By submitting, you agree that SIM.Africa may use these details to respond to your enquiry. See the <Link href="/privacy" className="font-semibold underline underline-offset-2">privacy notice</Link>.</p>
      <Button type="submit" className="mt-6 w-full sm:w-auto" disabled={status === "sending"}>{status === "sending" ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Sending…</> : "Talk to SIM.Africa Business"}</Button>
      {error ? <p role="alert" className="mt-4 text-sm font-semibold text-rose-700">{error}</p> : null}
    </form>
  );
}
