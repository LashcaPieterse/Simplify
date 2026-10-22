import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourceMarkdown } from "@/components/resources/ResourceMarkdown";
import { getResourcePostBySlug, getResourcePosts, isCurrentResource } from "@/lib/content/resources";

export const dynamic = "force-static";
export const revalidate = false;

export async function generateStaticParams() {
  const posts = await getResourcePosts();
  return posts.filter((post) => isCurrentResource(post)).map((post) => ({ slug: post.slug }));
}

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getResourcePostBySlug(slug);
  if (!post || !isCurrentResource(post)) return {};
  const image = post.coverImage;
  const canonical = `/resources/${slug}`;

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url: canonical,
      publishedTime: post.publishedAt,
      images: image ? [{ url: image, width: 1200, height: 630, alt: post.title }] : undefined,
    },
  };
}

const formatDate = (date?: string) => {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(date));
};

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getResourcePostBySlug(slug);

  if (!post || !isCurrentResource(post)) {
    notFound();
  }

  const coverImage = post.coverImage;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    image: coverImage ? [new URL(coverImage, process.env.NEXT_PUBLIC_APP_URL ?? "https://sim.africa").toString()] : undefined,
    publisher: { "@type": "Organization", name: "SIM.Africa", url: "https://sim.africa" },
    mainEntityOfPage: `https://sim.africa/resources/${slug}`,
  };

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema).replace(/</g, "\\u003c") }} />
      <Link href="/resources" className="text-sm font-semibold text-brand-600 hover:text-brand-800">
        ← Back to resources
      </Link>
      <header className="mt-8 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">{formatDate(post.publishedAt)}</p>
        <h1 className="font-display text-4xl text-brand-900 sm:text-5xl">{post.title}</h1>
        <p className="text-base text-brand-600">{post.excerpt}</p>
        <div className="text-xs uppercase tracking-[0.2em] text-brand-400">{post.readingMinutes} minute read</div>
      </header>
      {coverImage ? (
        <div className="relative mt-10 aspect-video overflow-hidden rounded-[2rem]">
          <Image src={coverImage} alt={post.title} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
        </div>
      ) : null}
      <div className="prose prose-brand mt-12 max-w-none">
        <ResourceMarkdown>{post.body}</ResourceMarkdown>
      </div>
    </article>
  );
}
