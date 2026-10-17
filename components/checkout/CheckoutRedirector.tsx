"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface CheckoutRedirectorProps {
  paymentUrl: string;
}

export function CheckoutRedirector({ paymentUrl }: CheckoutRedirectorProps) {
  useEffect(() => {
    if (!paymentUrl) {
      return;
    }

    window.location.assign(paymentUrl);
  }, [paymentUrl]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-brand-600">
        You are being redirected. If that does not happen automatically, continue using the button below.
      </p>
      <Button asChild variant="primary">
        <a href={paymentUrl}>Continue to payment</a>
      </Button>
    </div>
  );
}
