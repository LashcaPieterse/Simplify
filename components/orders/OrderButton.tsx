"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/utils";

const DEFAULT_ERROR_MESSAGE = "We couldn't place your order. Please try again.";

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];
type ButtonSize = React.ComponentProps<typeof Button>["size"];

type OrderButtonProps = {
  packageId?: string | null;
  label?: string;
  pendingLabel?: string;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  successPath?: (orderId: string) => string;
  onSuccess?: (orderId: string) => void;
  fullWidth?: boolean;
};

type OrderResponseBody = {
  orderId?: string;
  orderNumber?: string;
  message?: string;
  issues?: { message?: string; path?: (string | number)[] }[];
};

export function OrderButton({
  packageId,
  label = "Get this plan",
  pendingLabel = "Processing…",
  className,
  variant = "primary",
  size = "default",
  disabled,
  successPath,
  onSuccess,
  fullWidth,
}: OrderButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const buttonDisabled = disabled || isPending || !packageId;

  const handleClick = async () => {
    if (!packageId || isPending) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packageId }),
      });

      const data = (await response.json().catch(() => ({}))) as OrderResponseBody;

      if (!response.ok) {
        if (response.status === 401) {
          setError("Please refresh and try again.");
        } else if (response.status === 409) {
          setError(data.message ?? "This plan is currently out of stock.");
        } else if (response.status === 422) {
          const issueMessage = data.issues?.[0]?.message;
          setError(issueMessage ?? data.message ?? "This plan is unavailable right now.");
        } else {
          setError(data.message ?? DEFAULT_ERROR_MESSAGE);
        }
        return;
      }

      if (!data?.orderId) {
        setError(DEFAULT_ERROR_MESSAGE);
        return;
      }

      if (onSuccess) {
        onSuccess(data.orderId);
      } else if (successPath) {
        router.push(successPath(data.orderId));
      } else {
        router.push(`/orders/${data.orderId}`);
      }
    } catch (caughtError) {
      console.error("Failed to submit order", caughtError);
      setError(DEFAULT_ERROR_MESSAGE);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className={cn("space-y-2", fullWidth && "w-full", className)}>
      <Button
        type="button"
        onClick={handleClick}
        disabled={buttonDisabled}
        variant={variant}
        size={size}
        className={cn(fullWidth && "w-full")}
        aria-live="polite"
      >
        {isPending ? pendingLabel : label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
