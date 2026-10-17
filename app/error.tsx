"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><AlertTriangle className="mx-auto h-9 w-9 text-sand-600" aria-hidden /><h1 className="mt-5 text-3xl font-black text-brand-900">Something could not be loaded</h1><p className="mt-3 text-sm leading-6 text-brand-600">Your payment details have not been requested on this page. Try again, or contact support if the problem continues.</p><div className="mt-7 flex justify-center gap-3"><Button type="button" onClick={reset}>Try again</Button><Button asChild variant="secondary"><a href="mailto:support@sim.africa">Contact support</a></Button></div></div>;
}
