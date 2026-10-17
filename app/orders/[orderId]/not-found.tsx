import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OrderNotFound() {
  return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-3xl font-black text-brand-900">This order link is unavailable</h1><p className="mt-3 text-sm leading-6 text-brand-600">The link may be expired, broken, or not authorized for this browser. Sign in with the purchase email or contact support with the payment reference.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Button asChild><Link href="/auth/signin">Sign in</Link></Button><Button asChild variant="secondary"><a href="mailto:support@sim.africa">Contact support</a></Button></div></div>;
}
