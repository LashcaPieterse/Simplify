"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunSyncButton() {
  const [status, setStatus] = useState<"idle" | "running" | "error" | "done">("idle");
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        setStatus("running");
        const res = await fetch("/api/admin/sync", { method: "POST" });
        if (res.ok) {
          setStatus("done");
          router.refresh();
        } else {
          setStatus("error");
        }
      }}
      className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
      disabled={status === "running"}
    >
      {status === "running" ? "Syncing..." : "Run Sync Now"}
      {status === "error" ? <span className="text-amber-200">Retry</span> : null}
      {status === "done" ? <span className="text-emerald-100">✓</span> : null}
    </button>
  );
}
