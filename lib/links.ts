import type { AnchorHTMLAttributes } from "react";
import type { Link as SanityLink } from "@/lib/sanity.queries";

export const resolveLinkHref = (
  link?: Pick<SanityLink, "url"> | null,
  fallback = "#"
): string => {
  if (!link?.url) {
    return fallback;
  }

  const trimmed = link.url.trim();
  return trimmed.length ? trimmed : fallback;
};

type ExternalLinkAttributes = Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel">;

export const getExternalLinkProps = (
  href?: string | null
): ExternalLinkAttributes | undefined => {
  if (!href || href.startsWith("/")) {
    return undefined;
  }

  return {
    target: "_blank",
    rel: "noopener noreferrer"
  };
};

export const normalizeHref = (href?: string | null, fallback = "#"): string => {
  if (!href) {
    return fallback;
  }

  const trimmed = href.trim();
  return trimmed.length ? trimmed : fallback;
};
