"use client";

import { useTransition } from "react";
import { logoutAdmin } from "@/app/admin/login/actions";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          await logoutAdmin();
        });
      }}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      disabled={isPending}
    >
      {isPending ? "Signing out..." : "Logout"}
    </button>
  );
}
