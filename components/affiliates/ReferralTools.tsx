"use client";

import Image from "next/image";
import { useState } from "react";
import { safeReferralDestination } from "@/lib/affiliates/rules";
import { inputClass } from "./Fields";

export function ReferralTools({ origin, code }: { origin: string; code: string }) {
  const [destination, setDestination] = useState("/");
  const [copied, setCopied] = useState(false);
  const path = safeReferralDestination(destination);
  const link = `${origin}/r/${code}?to=${encodeURIComponent(path)}`;
  const qrUrl = `/api/affiliates/qr?to=${encodeURIComponent(path)}`;
  return <div className="space-y-4"><label className="block text-sm font-bold text-brand-900">Where should travellers land?<input className={inputClass} value={destination} onChange={event => { setDestination(event.target.value); setCopied(false); }} placeholder="/country/namibia" /></label><p className="text-xs leading-5 text-brand-600">Use / for the homepage, or paste a destination or plan path such as /country/namibia. Other paths use the destination directory.</p><label className="block text-sm font-bold text-brand-900">Your referral link<input className={inputClass} value={link} readOnly onFocus={event => event.target.select()} /></label><div className="flex flex-wrap items-center gap-4"><button type="button" className="rounded-xl bg-brand-900 px-4 py-2.5 text-sm font-bold text-white" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy link"}</button><a href={`${qrUrl}&download=1`} className="text-sm font-bold text-brand-700 underline">Download QR code</a></div><Image src={qrUrl} alt="QR code opening your SIM.Africa referral link" width={220} height={220} unoptimized /><p className="text-sm text-brand-700">Checkout referral code: <strong className="font-mono">{code}</strong></p><p className="text-xs leading-5 text-brand-500">This QR code opens your recommendation. It is different from the installation QR code travellers receive after purchase.</p></div>;
}
