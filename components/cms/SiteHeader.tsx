import Image from "next/image";
import Link from "next/link";
import type { SiteSettings } from "@/lib/sanity.queries";
import { Wifi } from "lucide-react";
import { urlForImage } from "@/lib/image";
import { getExternalLinkProps, resolveLinkHref } from "@/lib/links";
import { HeaderActions } from "./HeaderActions";

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  const logoUrl = settings.logo ? urlForImage(settings.logo)?.width(384).height(192).fit("max").auto("format").url() : null;

  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 pb-7 pt-8 sm:px-6 sm:pb-8 sm:pt-10 lg:px-10">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Link href="/" aria-label={settings.title} className="flex h-16 min-w-0 shrink items-center lg:h-24">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt=""
              width={178}
              height={96}
              className="h-auto max-h-16 w-auto max-w-[9.75rem] object-contain object-left lg:max-h-24 lg:max-w-none"
              priority
            />
          ) : (
            <Wifi aria-hidden="true" className="h-14 w-14 text-brand-600 lg:h-16 lg:w-16" />
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
