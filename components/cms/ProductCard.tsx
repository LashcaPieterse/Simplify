"use client";

import Image from "next/image";
import Link from "next/link";
import { OrderButton } from "@/components/orders/OrderButton";
import type { EsimProductSummary } from "@/lib/sanity.queries";
import { urlForImage } from "@/lib/image";
import { cn } from "@/components/utils";
import { getEsimProductHref } from "@/lib/products";

const formatPrice = (amount?: number, currency = "USD") => {
  if (typeof amount !== "number") {
    return "";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "USD" ? 0 : 2
    }).format(amount);
  } catch (error) {
    console.warn("Failed to format price", error);
    return `${amount}`;
  }
};

export function ProductCard({ product, className, ctaLabel = "Get plan" }: {
  product: EsimProductSummary;
  className?: string;
  ctaLabel?: string;
}) {
  const imageUrl = product.coverImage ? urlForImage(product.coverImage)?.width(240).height(160).url() : null;
  const href = getEsimProductHref(product);
  const priceAmount = product.price?.amount ?? product.priceUSD;
  const priceCurrency = product.price?.currency ?? "USD";
  const providerBadge = product.provider?.badge ?? product.providerBadge;
  const providerName = product.provider?.title ?? product.plan?.provider?.title;

  return (
    <article className={cn("flex items-start gap-4 rounded-2xl border border-brand-100/80 bg-white px-4 py-4 shadow-sm", className)}>
      <div className="relative h-16 w-20 overflow-hidden rounded-xl bg-sand-100/70">
        {imageUrl ? (
          <Image src={imageUrl} alt={`${product.displayName} cover`} fill className="object-cover" sizes="80px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-brand-400">No image</div>
        )}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-brand-800">{product.displayName}</p>
          {providerBadge ? (
            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase text-brand-600">
              {providerBadge}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-brand-500">
          {product.country?.title ? <span>{product.country.title}</span> : null}
          {providerName ? <span>{providerName}</span> : null}
        </div>
        {product.plan?.title ? <p className="font-medium text-brand-900">{product.plan.title}</p> : null}
        <p className="text-sm text-brand-600">{product.shortDescription}</p>
      </div>
      <div className="flex flex-col items-end gap-2 text-right">
        {typeof priceAmount === "number" ? (
          <p className="font-semibold text-brand-900">{formatPrice(priceAmount, priceCurrency)}</p>
        ) : null}
        <OrderButton
          packageId={product.package?.id}
          label={ctaLabel}
          pendingLabel="Processing…"
          variant="ghost"
          size="sm"
        />
        {href ? (
          <Link href={href} className="text-[0.65rem] font-semibold uppercase text-brand-500 hover:text-brand-700">
            View details
          </Link>
        ) : null}
      </div>
    </article>
  );
}
