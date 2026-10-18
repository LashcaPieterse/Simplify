import type { MetadataRoute } from "next";

import { getStorefrontCountries, getStorefrontPlanIdentifiers } from "@/lib/catalog/storefront";
import { getPosts } from "@/lib/sanity.queries";
import { isCurrentResource } from "@/lib/content/resources";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://sim.africa").replace(/\/$/, "");
  const [countries, planIds, posts] = await Promise.all([
    getStorefrontCountries().catch(() => []),
    getStorefrontPlanIdentifiers().catch(() => []),
    getPosts().catch(() => []),
  ]);
  const staticPages = [
    "",
    "/destinations",
    "/regional-esims",
    "/route-builder",
    "/compatibility",
    "/business",
    "/affiliates",
    "/help",
    "/help/installation",
    "/resources",
    "/refunds",
    "/privacy",
    "/terms",
  ];

  return [
    ...staticPages.map((path, index) => ({ url: `${baseUrl}${path}`, changeFrequency: index === 0 ? "daily" as const : "weekly" as const, priority: index === 0 ? 1 : 0.7 })),
    ...countries.map((country) => ({ url: `${baseUrl}/country/${country.slug}`, changeFrequency: "daily" as const, priority: 0.9 })),
    ...planIds.map((id) => ({ url: `${baseUrl}/plan/${encodeURIComponent(id)}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...posts.filter((post) => isCurrentResource(post)).map((post) => ({ url: `${baseUrl}/resources/${post.slug}`, lastModified: post.publishedAt ? new Date(post.publishedAt) : undefined, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
