"use client";

export default function AdminError({ retry }: { error: unknown; retry: () => void }) {
  return <section role="alert" className="space-y-4 rounded-2xl border border-brand-100 bg-white p-6"><h1 className="text-xl font-semibold text-brand-900">Operational records unavailable</h1><p className="text-sm text-slate-700">The requested data could not be loaded. Check database connectivity and deployment configuration. This does not establish that there are no affected records.</p><p className="text-sm text-slate-700">If an action was in progress, check its saved operation history after access is restored before submitting another request.</p><button onClick={retry} className="min-h-11 rounded-full bg-brand-900 px-5 py-2 font-semibold text-white">Reload records</button></section>;
}
