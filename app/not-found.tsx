import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><MapPinOff className="mx-auto h-10 w-10 text-brand-500" aria-hidden /><h1 className="mt-5 text-3xl font-black text-brand-900">We couldn’t find that page</h1><p className="mt-3 text-brand-600">The link may be outdated, or the package may no longer be available in the current catalogue.</p><Button asChild className="mt-7"><Link href="/destinations">Browse available destinations</Link></Button></div>;
}
