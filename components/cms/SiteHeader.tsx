import Image from "next/image";
import Link from "next/link";
import type { SiteSettings } from "@/lib/sanity.queries";
import { Button } from "@/components/ui/button";
import { Wifi } from "lucide-react";
import { urlForImage } from "@/lib/image";
import { getExternalLinkProps, resolveLinkHref } from "@/lib/links";

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  const logoUrl = settings.logo ? urlForImage(settings.logo)?.width(120).height(120).url() : null;

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-8 pt-10 lg:px-10">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          {logoUrl ? (
            <Image src={logoUrl} alt={settings.title} width={36} height={36} className="rounded-full" />
          ) : (
            <Wifi className="h-6 w-6 text-brand-600" />
          )}
          {settings.title}
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-brand-700 lg:flex">
          {settings.navigation?.map((link) => {
            const href = resolveLinkHref(link);
            const externalProps = getExternalLinkProps(href);

            return (
              <a key={link.label} href={href} className="transition hover:text-brand-900" {...externalProps}>
                {link.label}
              </a>
            );
          })}
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
