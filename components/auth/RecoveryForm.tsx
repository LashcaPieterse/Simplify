"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function RecoveryForm({ defaultEmail, returnTo, emailEnabled }: { defaultEmail: string; returnTo: string; emailEnabled: boolean }) {
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); setPending(true);
    try {
      const result = await signIn("email", { email: email.trim().toLowerCase(), callbackUrl: `/auth/recover?returnTo=${encodeURIComponent(returnTo)}`, redirect: false });
      setMessage(result?.error ? "Unable to send a recovery link. Please try again later." : "Check your inbox and follow the secure link to verify ownership.");
    } catch { setMessage("Unable to send a recovery link. Please try again later."); }
    finally { setPending(false); }
  }}>
    <label className="block text-sm font-semibold">Account email<input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="mt-2 block w-full rounded-xl border p-3" /></label>
    <button disabled={pending || !emailEnabled} className="rounded-xl bg-brand-900 px-5 py-3 text-white disabled:opacity-50">{pending ? "Sending…" : "Verify my email"}</button>
    <p role="status" className="text-sm">{message}</p>
    {!emailEnabled ? <p className="text-sm">Email recovery is unavailable. Contact support@sim.africa or sign in using a verified Google or Apple account with the same email.</p> : null}
  </form>;
}
