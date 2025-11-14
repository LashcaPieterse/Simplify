import Link from "next/link";
import type { Route } from "next";
import type { UrlObject } from "url";

import { Button } from "@/components/ui/button";

interface PaymentErrorActionsProps {
  checkoutId: string;
  retryPath?: Route | UrlObject;
}

export function PaymentErrorActions({ checkoutId, retryPath }: PaymentErrorActionsProps) {
  const retryHref: Route | UrlObject =
    retryPath ?? { pathname: "/checkout/[checkoutId]", query: { checkoutId } };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button asChild variant="primary">
        <Link href={retryHref}>Try payment again</Link>
      </Button>
      <Button asChild variant="secondary">
        <Link href="/">Choose a different plan</Link>
      </Button>
    </div>
  );
}
