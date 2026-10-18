"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function VerifyAffiliateEmail({ email }: { email: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return <div><button type="button" disabled={pending} className="mt-3 rounded-xl bg-brand-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60" onClick={async () => {
    setPending(true);
    try {
      const result = await signIn("email", { email, callbackUrl: "/account/affiliate", redirect: false });
      setMessage(result?.error ? "Unable to send a verification link. Please contact support." : "Check your inbox and follow the secure sign-in link to verify your email.");
    } catch { setMessage("Unable to send a verification link. Please try again."); }
    finally { setPending(false); }
  }}>{pending ? "Sending…" : "Email me a verification link"}</button><p className="mt-2 text-sm" role="status">{message}</p></div>;
}
