import type { SanityDocument } from "sanity";

const basePath = process.env.SANITY_STUDIO_PREVIEW_BASE_URL || "";

const pathForType = (doc: SanityDocument): string => {
  const slug = typeof doc?.slug === "object" ? doc.slug?.current : undefined;

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
