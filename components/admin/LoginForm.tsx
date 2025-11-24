"use client";

import { useState, useTransition } from "react";
import { loginAdmin } from "@/app/admin/login/actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="mx-auto mt-12 max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await loginAdmin(formData);
          if (!result.success) {
            setError(result.error ?? "Unable to sign in");
            return;
          }

          window.location.href = "/admin";
        });
      }}
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Admin sign-in</h1>
        <p className="text-sm text-slate-600">Use your Simplify admin credentials.</p>
      </div>
      <div className="mt-8 space-y-6">
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none"
            placeholder="admin@simplify.com"
            disabled={isPending}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            name="password"
            type="password"
            required
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none"
            placeholder="••••••••"
            disabled={isPending}
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
        >
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </form>
  );
}
