import type { LinkProps } from "next/link";
import { urlForImage } from "./image";
import type { EsimProductSummary } from "./sanity.queries";

export type LinkHref = LinkProps<string>["href"];

export type EsimProductCardData = {
  id: string;
  title: string;
  badge?: string;
  providerName?: string;
  description?: string;
  href?: LinkHref;
  ctaLabel?: string;
  image?: {
    url: string | null;
    alt?: string;
  };
  price?: {
    amount?: number;
    currency?: string;
    label?: string;
  };
};

export const getEsimProductHref = (product: EsimProductSummary): LinkHref | undefined => {
  const planSlug = product.slugs?.plan ?? product.plan?.slug;
  if (planSlug) {
    return `/plan/${planSlug}`;
  }

  const productSlug = product.slugs?.product ?? product.slug;
  if (productSlug) {
    return `/product/${productSlug}`;
  }

  const countrySlug = product.slugs?.country ?? product.country?.slug;
  if (countrySlug) {
    return `/country/${countrySlug}`;
  }

  return undefined;
};

export const mapProductToCardData = (product: EsimProductSummary): EsimProductCardData => {
  const href = getEsimProductHref(product);
  const imageUrl = product.coverImage ? urlForImage(product.coverImage)?.width(360).height(240).url() ?? null : null;
  const priceAmount = product.price?.amount ?? product.priceUSD;
  const priceCurrency = product.price?.currency ?? "USD";
  const providerBadge = product.provider?.badge ?? product.providerBadge;
  const providerName = product.provider?.title ?? product.plan?.provider?.title;

  return {
    id: product._id,
    title: product.displayName,
    badge: providerBadge,
    providerName,
    description: product.shortDescription,
    href,
    image: {
      url: imageUrl,
      alt: `${product.displayName} cover`
    },
    price: {
      amount: priceAmount,
      currency: priceCurrency
    }
  };
};
