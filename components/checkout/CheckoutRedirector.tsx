"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

interface CheckoutRedirectorProps {
  paymentUrl: string;
}

export function CheckoutRedirector({ paymentUrl }: CheckoutRedirectorProps) {
  const [attemptedRedirect, setAttemptedRedirect] = useState(false);

  useEffect(() => {
    if (!paymentUrl) {
      return;
    }

    setAttemptedRedirect(true);
    window.location.assign(paymentUrl);
  }, [paymentUrl]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {attemptedRedirect
          ? "If you are not redirected automatically, continue to payment using the button below."
          : "Continue to payment to complete your purchase."}
      </p>
      <Button asChild variant="primary">
        <a href={paymentUrl}>Continue to payment</a>
      </Button>
    </div>
  );
}
