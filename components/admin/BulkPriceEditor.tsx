"use client";

import { useState, useTransition } from "react";
import { saveBulkPrices } from "@/app/admin/operations/actions";
import { formatCurrency } from "@/lib/format";

type PackageLite = {
  id: string;
  name: string;
  country: string | null;
  currency: string;
  priceCents: number;
  sellingPriceCents: number | null;
};

export function BulkPriceEditor({ packages }: { packages: PackageLite[] }) {
  const [rows, setRows] = useState(packages);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Bulk price editor</h3>
          <p className="text-sm text-slate-600">Inline edit selling prices and save in one action.</p>
        </div>
        <button
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await saveBulkPrices(
                rows.map((row) => ({ id: row.id, sellingPriceCents: row.sellingPriceCents ?? row.priceCents }))
              );
              setMessage("Saved updates");
            });
          }}
        >
          {isPending ? "Saving..." : "Save all"}
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
      <div className="mt-4 overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Name</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Country</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Base</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Selling</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => {
              const selling = row.sellingPriceCents ?? row.priceCents;
              const margin = Math.round(((selling - row.priceCents) / row.priceCents) * 100);
              return (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-semibold text-slate-900">{row.name}</td>
                  <td className="px-3 py-2">{row.country ?? "-"}</td>
                  <td className="px-3 py-2">{formatCurrency(row.priceCents, row.currency)}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={(selling / 100).toFixed(2)}
                      className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
                      onChange={(event) => {
                        const value = Number(event.target.value) * 100;
                        setRows((prev) => {
                          const clone = [...prev];
                          clone[index] = { ...clone[index], sellingPriceCents: Math.round(value) };
                          return clone;
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{margin}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
