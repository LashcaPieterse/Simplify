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
  if (product.plan?.slug) {
    return {
      pathname: "/plan/[slug]",
      query: { slug: product.plan.slug }
    } as const;
  }

  if (product.slug) {
    return {
      pathname: "/product/[slug]",
      query: { slug: product.slug }
    } as const;
  }

  if (product.country?.slug) {
    return {
      pathname: "/country/[slug]",
      query: { slug: product.country.slug }
    } as const;
  }

  return undefined;
};

export const mapProductToCardData = (product: EsimProductSummary): EsimProductCardData => {
  const href = getEsimProductHref(product);
  const imageUrl = product.coverImage ? urlForImage(product.coverImage)?.width(360).height(240).url() ?? null : null;

  return {
    id: product._id,
    title: product.displayName,
    badge: product.providerBadge,
    providerName: product.plan?.provider?.title,
    description: product.shortDescription,
    href,
    image: {
      url: imageUrl,
      alt: `${product.displayName} cover`
    },
    price: {
      amount: product.priceUSD,
      currency: "USD"
    }
  };
};
