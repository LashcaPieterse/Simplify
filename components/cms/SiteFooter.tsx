import Link from "next/link";
import type { SiteSettings } from "@/lib/sanity.queries";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mx-auto mb-10 mt-20 flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-brand-600 lg:px-10">
      <p>© {new Date().getFullYear()} {settings.title}. All rights reserved.</p>
      <div className="flex items-center gap-4">
        {settings.footerLinks?.length
          ? settings.footerLinks.map((link) => (
              <Link key={link.label} href={link.url} className="hover:text-brand-900">
                {link.label}
              </Link>
            ))
          : null}
      </div>
    </footer>
  );
}
