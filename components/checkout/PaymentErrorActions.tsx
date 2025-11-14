import Link from "next/link";

import { Button } from "@/components/ui/button";

interface PaymentErrorActionsProps {
  checkoutId: string;
  retryPath?: string;
}

export function PaymentErrorActions({ checkoutId, retryPath }: PaymentErrorActionsProps) {
  const retryHref = retryPath ?? `/checkout/${checkoutId}`;

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
