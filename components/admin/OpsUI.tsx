import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import type { AdminOperation } from "@prisma/client";
import { formatOpsTime } from "@/lib/admin/queries";
import { OperationForm } from "./OperationForm";

export function OpsLink({ href, children }: { href: string; children: ReactNode }) { return <Link href={href as Route} className="break-all font-medium text-brand-900 underline underline-offset-4">{children}</Link>; }
export function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5"><h2 className="text-lg font-semibold text-brand-900">{title}</h2>{children}</section>; }
export function Badge({ children }: { children: ReactNode }) { return <span className="inline-flex rounded-lg border border-brand-100 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-900">{children}</span>; }
export function Empty({ children = "No matching records." }: { children?: ReactNode }) { return <p className="py-5 text-sm text-slate-600">{children}</p>; }
export function PageTitle({ title, description }: { title: string; description: string }) { return <div><h1 className="text-3xl font-bold text-brand-900">{title}</h1><p className="mt-2 text-sm text-slate-600">{description}</p></div>; }
export function Pagination({ page, hasNext, path, q, filter }: { page: number; hasNext: boolean; path: string; q: string; filter: string }) {
  const url = (value: number) => `${path}?${new URLSearchParams({ page: String(value), q, filter })}`;
  return <nav aria-label="Pagination" className="flex items-center gap-5 text-sm">{page > 1 ? <OpsLink href={url(page - 1)}>Previous</OpsLink> : null}<span>Page {page}</span>{hasNext ? <OpsLink href={url(page + 1)}>Next</OpsLink> : null}</nav>;
}
export function OperationsHistory({ operations }: { operations: AdminOperation[] }) {
  return <Panel title="Operation history">{!operations.length ? <Empty>No operator actions recorded.</Empty> : operations.map(op => <div key={op.id} className="space-y-2 border-t border-brand-100 pt-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{op.kind.replaceAll("_", " ")} · <Badge>{op.status}</Badge></p><time>{formatOpsTime(op.startedAt)}</time></div><p>{op.reason}</p><p className="break-all text-xs text-slate-600">{op.actorEmail} · {op.id} · {op.resultCode ?? "Awaiting result"}{op.reference ? ` · Reference ${op.reference}` : ""}</p>{op.kind === "replace_order" && op.reference ? <OpsLink href={`/admin/orders/${op.reference}`}>Replacement order</OpsLink> : null}{["refund", "supplier_refund", "capture", "cancel_payment", "replace_order"].includes(op.kind) && ["unknown", "provider_pending"].includes(op.status) ? <OperationForm targetId={op.id} version={op.updatedAt.toISOString()} context={`Resolve ${op.kind} operation ${op.id}. This records independently verified provider evidence; it does not submit another provider mutation.`} actions={[{ kind: op.kind === "refund" ? "resolve_refund" : op.kind === "supplier_refund" ? "resolve_supplier_refund" : "resolve_operation", label: "Record provider outcome", effect: "Confirm only after checking the provider record. Payment completion and replacement fulfilment still require independent verification. For a rejected outcome, record evidence that the provider did not process the request.", reference: "Provider evidence reference", resolution: true }]} /> : null}</div>)}</Panel>;
}
