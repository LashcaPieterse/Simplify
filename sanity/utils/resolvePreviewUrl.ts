import type { SanityDocument } from "sanity";

const basePath = process.env.SANITY_STUDIO_PREVIEW_BASE_URL || "";

type SlugSource = { current?: unknown } | string | null | undefined;

const resolveSlug = (value: SlugSource): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "current" in value) {
    const current = value.current;
    return typeof current === "string" ? current : undefined;
  }

  return undefined;
};

const pathForType = (doc: SanityDocument): string => {
  const slug = resolveSlug(doc?.slug as SlugSource);

  switch (doc._type) {
    case "homePage":
    case "siteSettings":
      return "/";
    case "country":
      return slug ? `/country/${slug}` : "/country";
    case "plan":
      return slug ? `/plan/${slug}` : "/plan";
    case "regionBundle":
      return slug ? `/bundle/${slug}` : "/bundle";
    case "post":
      return slug ? `/resources/${slug}` : "/resources";
    default:
      return "/";
  }
};

export const resolvePreviewUrl = (doc: SanityDocument): string => {
  const path = pathForType(doc);
  const base = basePath.replace(/\/$/, "");
  const previewSecret = process.env.SANITY_PREVIEW_SECRET;
  const url = `${base || ""}/api/preview?secret=${previewSecret ?? ""}&slug=${encodeURIComponent(path)}`;
  return url;
};
