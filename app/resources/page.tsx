import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPosts } from "@/lib/sanity.queries";
import { urlForImage } from "@/lib/image";

export const dynamic = "force-static";
export const revalidate = false;

const formatDate = (date?: string) => {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
};

export default async function ResourcesPage() {
  const posts = await getPosts();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Resources</p>
          <h1 className="font-display text-4xl text-brand-900 sm:text-5xl">Guides, routes &amp; roaming tips</h1>
          <p className="mt-4 max-w-2xl text-base text-brand-600">
            Stories from across the Simplify network: carrier deep-dives, regional coverage breakdowns, and traveller checklists.
          </p>
        </div>
        <Button variant="secondary" className="self-start sm:self-end">
          Subscribe to newsletter
        </Button>
      </div>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        {posts.map((post) => {
          const imageUrl = post.coverImage ? urlForImage(post.coverImage)?.width(640).height(420).url() : null;
          return (
            <article key={post._id} className="flex h-full flex-col overflow-hidden rounded-3xl border border-brand-100/80 bg-white shadow-card">
              {imageUrl ? (
                <div className="relative h-64 w-full">
                  <Image src={imageUrl} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 640px" />
                </div>
              ) : null}
              <div className="flex flex-1 flex-col gap-4 p-6">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-brand-400">
                  <span>{formatDate(post.publishedAt)}</span>
                  <span>{post.readingMinutes} min read</span>
                </div>
                <h2 className="font-display text-2xl text-brand-900">
                  <Link href={`/resources/${post.slug}`}>{post.title}</Link>
                </h2>
                <p className="text-sm text-brand-600">{post.excerpt}</p>
                <div className="mt-auto flex items-center justify-between text-sm font-semibold text-brand-600">
                  <Link href={`/resources/${post.slug}`} className="inline-flex items-center gap-2 hover:text-brand-800">
                    Read article
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  {post.tags?.length ? (
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-600">
                      {post.tags[0]}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
