import { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  helper,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success" ? "bg-teal-50 text-teal-800" : tone === "warning" ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-800";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-600">{label}</div>
        {icon ? <div className={`flex h-9 w-9 items-center justify-center rounded-full ${toneClass}`}>{icon}</div> : null}
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
      {helper ? <div className="mt-1 text-sm text-slate-500">{helper}</div> : null}
    </div>
  );
}
