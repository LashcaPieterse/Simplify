import Image from "next/image";
import Link from "next/link";
import type { Link as SanityLink, SiteSettings } from "@/lib/sanity.queries";
import { Button } from "@/components/ui/button";
import { urlForImage } from "@/lib/image";

const getHref = (link: SanityLink) => link.url ?? "#";

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  const logoUrl = settings.logo ? urlForImage(settings.logo)?.width(120).height(120).url() : null;

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-8 pt-10 lg:px-10">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          {logoUrl ? (
            <Image src={logoUrl} alt={settings.title} width={36} height={36} className="rounded-full" />
          ) : (
            <span className="material-symbols-rounded text-2xl text-brand-600">wifi</span>
          )}
          {settings.title}
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-brand-700 lg:flex">
          {settings.navigation?.map((link) => (
            <Link key={link.label} href={getHref(link)} className="transition hover:text-brand-900">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="hidden md:inline-flex">
          Log in
        </Button>
        <Button size="sm">Sign up</Button>
      </div>
    </header>
  );
}
