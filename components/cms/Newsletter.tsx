import Link from "next/link";
import { ArrowUpRight, BookOpen, CircleHelp, Smartphone } from "lucide-react";
import type { NewsletterSection } from "@/lib/sanity.queries";
import { Button } from "@/components/ui/button";
import { getExternalLinkProps, normalizeHref } from "@/lib/links";

export function Newsletter({ section }: { section: NewsletterSection }) {
  const href = normalizeHref(section.ctaTarget);
  const externalProps = getExternalLinkProps(href);

  return (
    <section id="resources" className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
      <div className="rounded-[2rem] border border-brand-100/80 bg-brand-900 px-10 py-14 text-sand-50 shadow-card">
        <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sand-200">Stay in the know</p>
            <h2 className="font-display text-3xl text-white sm:text-4xl">{section.title}</h2>
            <p className="max-w-xl text-base text-sand-100/90">{section.body}</p>
            <Button variant="secondary" size="lg" className="bg-white/15 text-white hover:bg-white/25" asChild>
              <a href={href} {...externalProps}>
                {section.ctaLabel}
              </a>
            </Button>
          </div>
          <div className="space-y-4 rounded-[1.75rem] border border-white/15 bg-white/5 p-6">
            <ResourceLink href="/help" label="Help centre" icon={CircleHelp} />
            <ResourceLink href="/help/installation" label="Installation guide" icon={BookOpen} />
            <ResourceLink href="/compatibility" label="Device compatibility" icon={Smartphone} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ResourceLink({ href, label, icon: Icon }: { href: "/help" | "/help/installation" | "/compatibility"; label: string; icon: typeof CircleHelp }) {
  return (
    <Link href={href} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-4 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
      <span className="flex items-center gap-3 text-sm font-medium"><Icon className="h-5 w-5 text-sand-200" aria-hidden />{label}</span>
      <ArrowUpRight className="h-5 w-5 text-sand-200" aria-hidden />
    </Link>
  );
}
