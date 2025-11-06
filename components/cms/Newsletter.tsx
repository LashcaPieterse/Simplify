import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import type { NewsletterSection } from "@/lib/sanity.queries";
import { Button } from "@/components/ui/button";

type ExternalLinkProps = {
  target: "_blank";
  rel: "noopener noreferrer";
};

const getExternalLinkProps = (href: string): Partial<ExternalLinkProps> => {
  if (href.startsWith("/")) {
    return {};
  }

  return {
    target: "_blank",
    rel: "noopener noreferrer"
  };
};

export function Newsletter({ section }: { section: NewsletterSection }) {
  const href = section.ctaTarget.trim() ? section.ctaTarget : "#";
  const externalProps = getExternalLinkProps(href);

  return (
    <section id="resources" className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
      <div className="rounded-[2rem] border border-brand-100/80 bg-brand-900 px-10 py-14 text-sand-50 shadow-card">
        <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sand-200">Stay in the know</p>
            <h2 className="font-display text-3xl text-white sm:text-4xl">{section.title}</h2>
            <p className="max-w-xl text-base text-sand-100/90">{section.body}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex flex-1 items-center gap-3 rounded-full border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-md">
                <MagnifyingGlassIcon className="h-5 w-5 text-sand-200" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full bg-transparent text-sm text-white placeholder:text-sand-200/70 focus:outline-none"
                />
              </label>
              <Button variant="secondary" size="lg" className="bg-white/15 text-white hover:bg-white/25" asChild>
                <a href={href} {...externalProps}>
                  {section.ctaLabel}
                </a>
              </Button>
            </div>
          </div>
          <div className="space-y-4 rounded-[1.75rem] border border-white/15 bg-white/5 p-6">
            {["What is an eSIM?", "How to switch carriers abroad", "Best data plans for digital nomads"].map((topic) => (
              <div key={topic} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-white">{topic}</p>
                  <p className="text-xs text-sand-200/70">5 min read</p>
                </div>
                <span className="material-symbols-rounded text-sand-200">arrow_outward</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
