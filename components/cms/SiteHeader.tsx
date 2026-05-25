import Image from "next/image";
import Link from "next/link";
import type { SiteSettings } from "@/lib/sanity.queries";
import { Wifi } from "lucide-react";
import { urlForImage } from "@/lib/image";
import { getExternalLinkProps, resolveLinkHref } from "@/lib/links";
import { HeaderActions } from "./HeaderActions";

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  const logoUrl = settings.logo ? urlForImage(settings.logo)?.width(240).height(120).fit("max").auto("format").url() : null;

  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-8 pt-10 lg:px-10">
      <div className="flex items-center gap-4">
        <Link href="/" aria-label={settings.title} className="flex items-center">
          {logoUrl ? (
            <Image src={logoUrl} alt="" width={104} height={56} className="h-14 w-auto object-contain" priority />
          ) : (
            <Wifi aria-hidden="true" className="h-10 w-10 text-brand-600" />
          )}
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
      <HeaderActions />
    </header>
  );
}
