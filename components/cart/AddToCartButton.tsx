"use client";

import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/utils";
import { trackEvent } from "@/lib/analytics";
import { type CartItem, useCart } from "./CartProvider";

export function AddToCartButton({
  item,
  label = "Choose plan",
  goToCart = true,
  className,
}: {
  item: Omit<CartItem, "quantity">;
  label?: string;
  goToCart?: boolean;
  className?: string;
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);

  return (
    <Button
      type="button"
      className={cn("w-full", className)}
      onClick={() => {
        trackEvent("plan_selected", {
          package_id: item.packageId,
          destination: item.destination,
        });
        addItem(item);
        setAdded(true);
        if (goToCart) router.push("/cart");
      }}
    >
      {added && !goToCart ? <Check className="h-4 w-4" aria-hidden /> : <ShoppingBag className="h-4 w-4" aria-hidden />}
      {added && !goToCart ? "Added to cart" : label}
    </Button>
  );
}
