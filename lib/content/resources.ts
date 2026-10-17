type DatedResource = {
  title: string;
  slug: string;
};

/**
 * Evergreen resources remain publishable. A guide that explicitly names an
 * earlier calendar year is treated as stale until editorial updates it; this is
 * safer than presenting time-sensitive coverage advice as current.
 */
export function isCurrentResource(resource: DatedResource, currentYear = new Date().getUTCFullYear()): boolean {
  const explicitYears = `${resource.title} ${resource.slug}`
    .match(/\b20\d{2}\b/g)
    ?.map(Number) ?? [];

  return explicitYears.every((year) => year >= currentYear);
}
