"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "running" | "done" | "error";

export function RunSanitySyncButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={async () => {
          setStatus("running");
          setMessage(null);

          try {
            const response = await fetch("/api/admin/sanity-sync", { method: "POST" });
            const data = (await response.json().catch(() => ({}))) as {
              countries?: number;
              operators?: number;
              packages?: number;
              error?: string;
            };

            if (!response.ok) {
              setStatus("error");
              setMessage(data.error ?? "Sanity sync failed.");
              return;
            }

            setStatus("done");
            setMessage(
              `Synced countries=${data.countries ?? 0}, operators=${data.operators ?? 0}, packages=${data.packages ?? 0}.`,
            );
            router.refresh();
          } catch (error) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Sanity sync failed.");
          }
        }}
        disabled={status === "running"}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {status === "running" ? "Syncing Sanity..." : "Sync DB to Sanity"}
      </button>
      {message ? (
        <p className={`text-xs ${status === "error" ? "text-rose-600" : "text-slate-600"}`}>{message}</p>
      ) : null}
    </div>
  );
}
