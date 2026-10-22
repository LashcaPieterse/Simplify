import { readFile, readdir } from "node:fs/promises";
import { statSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";

const resourceMetadataSchema = z.object({
  title: z.string().trim().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().trim().min(1).max(240),
  publishedAt: z.preprocess(
    (value) => value instanceof Date ? value.toISOString() : value,
    z.string().datetime({ offset: true }),
  ),
  readingMinutes: z.number().positive(),
  tags: z.array(z.string().trim().min(1)).default([]),
  coverImage: z.string().optional(),
}).strict();

export type ResourcePost = z.infer<typeof resourceMetadataSchema> & { body: string };

type ResourceDirectories = { contentDirectory?: string; publicDirectory?: string };

/** Resource images are repository assets, validated before a page can be published. */
export function assertResourceImage(source: string, publicDirectory = join(process.cwd(), "public")): void {
  if (!/^\/images\/resources\/[a-z0-9][a-z0-9._-]*\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(source)) {
    throw new Error(`Resource images must use a local /images/resources/ path: ${source}`);
  }
  const path = join(publicDirectory, source.slice(1));
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing resource image: ${source}`);
  }
}

export async function getResourcePosts(directories: ResourceDirectories = {}): Promise<ResourcePost[]> {
  const contentDirectory = directories.contentDirectory ?? join(process.cwd(), "content/resources");
  const publicDirectory = directories.publicDirectory ?? join(process.cwd(), "public");
  const filenames = (await readdir(contentDirectory)).filter((name) => name.endsWith(".md")).sort();
  const posts: ResourcePost[] = [];
  const slugs = new Set<string>();

  for (const filename of filenames) {
    const parsed = matter(await readFile(join(contentDirectory, filename), "utf8"));
    const result = resourceMetadataSchema.safeParse(parsed.data);
    if (!result.success) throw new Error(`Invalid resource metadata in ${filename}: ${result.error.message}`);
    const metadata = result.data;
    if (slugs.has(metadata.slug)) throw new Error(`Duplicate resource slug: ${metadata.slug}`);
    if (filename !== `${metadata.slug}.md`) throw new Error(`Resource filename must match its slug: ${filename}`);
    slugs.add(metadata.slug);
    if (!parsed.content.trim()) throw new Error(`Empty resource body: ${filename}`);
    if (metadata.coverImage) assertResourceImage(metadata.coverImage, publicDirectory);
    posts.push({ ...metadata, body: parsed.content.trim() });
  }

  return posts.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.slug.localeCompare(b.slug));
}

export async function getResourcePostBySlug(slug: string, directories: ResourceDirectories = {}): Promise<ResourcePost | null> {
  // Enumerate known posts instead of constructing a filesystem path from a request.
  return (await getResourcePosts(directories)).find((post) => post.slug === slug) ?? null;
}

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
