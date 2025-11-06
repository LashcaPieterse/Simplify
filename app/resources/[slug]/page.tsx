import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, getPosts } from "@/lib/sanity.queries";
import { urlForImage } from "@/lib/image";
import { PortableTextRenderer } from "@/components/rich/PortableText";

export const revalidate = 60;

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

type PostPageProps = {
  params: { slug: string };
};

const formatDate = (date?: string) => {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(date));
};

export default async function PostPage({ params }: PostPageProps) {
  const post = await getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const coverImage = post.coverImage ? urlForImage(post.coverImage)?.width(1280).height(720).url() : null;

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
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
        <div className="mt-10 overflow-hidden rounded-[2rem]">
          <Image src={coverImage} alt={post.title} width={1280} height={720} className="h-auto w-full object-cover" />
        </div>
      ) : null}
      <div className="prose prose-brand mt-12 max-w-none">
        <PortableTextRenderer value={post.body} />
      </div>
    </article>
  );
}
