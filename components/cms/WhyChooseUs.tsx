import { Sparkles, ShieldCheck, Zap, Globe2, Waves, Compass } from "lucide-react";
import type { WhyChooseUsSection } from "@/lib/sanity.queries";

const iconMap: Record<string, JSX.Element> = {
  sparkles: <Sparkles className="h-6 w-6 text-brand-600" />,
  shield: <ShieldCheck className="h-6 w-6 text-brand-600" />,
  zap: <Zap className="h-6 w-6 text-brand-600" />,
  globe: <Globe2 className="h-6 w-6 text-brand-600" />,
  waves: <Waves className="h-6 w-6 text-brand-600" />,
  compass: <Compass className="h-6 w-6 text-brand-600" />
};

const getIcon = (iconName: string) => iconMap[iconName] ?? iconMap.sparkles;

export function WhyChooseUs({ section }: { section: WhyChooseUsSection }) {
  return (
    <section id="store" className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
      <div className="mb-12 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Why travellers choose us</p>
        <h2 className="mt-3 font-display text-3xl text-brand-900 sm:text-4xl">{section.title}</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {section.bullets.map((bullet) => (
          <div
            key={bullet.title}
            className="rounded-3xl border border-brand-100/80 bg-white p-6 shadow-card"
          >
            <div className="mb-4 inline-flex rounded-full bg-brand-100/80 p-3 text-brand-600">{getIcon(bullet.iconName)}</div>
            <p className="font-display text-xl text-brand-900">{bullet.title}</p>
            <p className="mt-3 text-sm text-brand-600">{bullet.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
