import type { InputHTMLAttributes, ReactNode } from "react";

export const inputClass = "mt-2 w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-base font-normal text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-300";
export const panelClass = "rounded-3xl border border-brand-100 bg-white p-5 shadow-card sm:p-7";
export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block text-sm font-semibold text-brand-900">{label}<input {...props} className={inputClass} /></label>;
}
export function TextField({ name, label, required = false, maxLength = 2000 }: { name: string; label: string; required?: boolean; maxLength?: number }) {
  return <label className="block text-sm font-semibold text-brand-900">{label}<textarea name={name} required={required} maxLength={maxLength} rows={3} className={inputClass} /></label>;
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className={panelClass}><h2 className="mb-5 text-xl font-bold text-brand-900">{title}</h2>{children}</section>;
}
