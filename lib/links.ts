const EXTERNAL_LINK_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function isHashLink(href: string) {
  return href.startsWith("#");
}

function isRelativePath(href: string) {
  return href.startsWith("/");
}

/**
 * Normalise href strings coming from CMS driven content. Ensures the value is safe
 * to pass to an <a /> element and gracefully falls back to a hash if nothing valid
 * is provided.
 */
export function normalizeHref(rawHref: string | null | undefined): string {
  if (!rawHref) {
    return "#";
  }

  const trimmedHref = rawHref.trim();

  if (!trimmedHref) {
    return "#";
  }

  if (isHashLink(trimmedHref) || isRelativePath(trimmedHref)) {
    return trimmedHref;
  }

  if (EXTERNAL_LINK_PATTERN.test(trimmedHref)) {
    return trimmedHref;
  }

  return `https://${trimmedHref}`;
}

function isExternalHref(normalizedHref: string) {
  if (!normalizedHref || normalizedHref === "#") {
    return false;
  }

  if (isHashLink(normalizedHref) || isRelativePath(normalizedHref)) {
    return false;
  }

  return EXTERNAL_LINK_PATTERN.test(normalizedHref);
}

export function getExternalLinkProps(href: string | null | undefined) {
  const normalizedHref = normalizeHref(href);

  if (!isExternalHref(normalizedHref)) {
    return {};
  }

  return {
    target: "_blank",
    rel: "noopener noreferrer" as const
  };
}
