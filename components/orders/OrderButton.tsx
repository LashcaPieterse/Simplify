"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/utils";

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
  fullWidth?: boolean;
};

export function OrderButton({
  packageId,
  label = "Get this plan",
  pendingLabel = "Opening checkout...",
  className,
  variant = "primary",
  size = "default",
  disabled,
  fullWidth,
}: OrderButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const buttonDisabled = disabled || isPending || !packageId;

  const handleClick = () => {
    if (!packageId || isPending) {
      return;
    }

    setIsPending(true);
    router.push(`/checkout/new?packageId=${encodeURIComponent(packageId)}` as Route);
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
    </div>
  );
}
