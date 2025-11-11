import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/utils";
import type { EsimProductCardData } from "@/lib/products";

const formatPrice = (price?: { amount?: number; currency?: string }) => {
  if (typeof price?.amount !== "number") {
    return null;
  }

  const currency = price.currency ?? "USD";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(price.amount);
};

export function EsimProductCard({
  product,
  className
}: {
  product: EsimProductCardData;
  className?: string;
}) {
  const formattedPrice =
    typeof product.price?.amount === "number"
      ? formatPrice({ amount: product.price.amount, currency: product.price.currency })
      : null;
  const href = product.href;
  const ctaLabel = product.ctaLabel ?? "View details";
  const imageAlt = product.image?.alt ?? `${product.title} cover`;

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-3xl border border-brand-100/80 bg-white p-6 shadow-card",
        className
      )}
    >
      <div className="relative mb-5 h-40 w-full overflow-hidden rounded-2xl bg-sand-100/60">
        {product.image?.url ? (
          <Image src={product.image.url} alt={imageAlt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 360px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-brand-400">Image coming soon</div>
        )}
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl text-brand-900">{product.title}</h3>
          {product.badge ? (
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase text-brand-600">
              {product.badge}
            </span>
          ) : null}
        </div>
        {product.providerName ? <p className="text-sm text-brand-500">{product.providerName}</p> : null}
        {product.description ? <p className="text-sm text-brand-600">{product.description}</p> : null}
      </div>
      <div className="mt-6 flex items-center justify-between">
        {formattedPrice ? (
          <p className="text-lg font-semibold text-brand-900">{formattedPrice}</p>
        ) : product.price?.label ? (
          <span className="text-sm text-brand-500">{product.price.label}</span>
        ) : (
          <span className="text-sm text-brand-500">Multiple plans</span>
        )}
        <Button size="sm" asChild disabled={!href}>
          {href ? <Link href={href}>{ctaLabel}</Link> : <span>{ctaLabel}</span>}
        </Button>
      </div>
    </article>
  );
}
