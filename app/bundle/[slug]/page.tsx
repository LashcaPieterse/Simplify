import { permanentRedirect } from "next/navigation";

export default async function LegacyBundlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/regional-esims#${encodeURIComponent(slug)}`);
}
