import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ArticlesSection } from "@/lib/sanity.queries";
import { urlForImage } from "@/lib/image";

const formatDate = (date?: string) => {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
};

export function Articles({ section }: { section: ArticlesSection }) {
  return (
    <section className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
      <div className="mb-10 flex items-center justify-between gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Resources</p>
          <h2 className="mt-3 font-display text-3xl text-brand-900 sm:text-4xl">{section.title}</h2>
        </div>
        <Link href="/resources" className="text-sm font-medium text-brand-600 hover:text-brand-800">
          View all
        </Link>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        {section.posts.map((post) => {
          const imageUrl = post.coverImage ? urlForImage(post.coverImage)?.width(400).height(260).url() : null;
          return (
            <article key={post._id} className="flex h-full flex-col overflow-hidden rounded-3xl border border-brand-100/80 bg-white shadow-card">
              {imageUrl ? (
                <div className="relative h-48 w-full">
                  <Image src={imageUrl} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 360px" />
                </div>
              ) : null}
              <div className="flex flex-1 flex-col gap-4 p-6">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-brand-400">
                  <span>{formatDate(post.publishedAt)}</span>
                  <span>{post.readingMinutes} min read</span>
                </div>
                <h3 className="font-display text-xl text-brand-900">
                  <Link href={`/resources/${post.slug}`}>{post.title}</Link>
                </h3>
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
    </section>
  );
}
