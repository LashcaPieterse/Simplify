import { Radio, SignalHigh } from "lucide-react";
import type { LiveNetworkWidgetSection } from "@/lib/sanity.queries";

export function LiveNetworkWidget({ section }: { section: LiveNetworkWidgetSection }) {
  return (
    <section className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
      <div className="rounded-[2rem] border border-brand-100/80 bg-white/70 p-8 shadow-card backdrop-blur">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-700">{section.title}</p>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-brand-500">
            <Radio className="h-4 w-4 text-brand-400" />
            Updated moments ago
          </span>
        </div>
        <div className="grid gap-4">
          {section.regions.map((region, index) => (
            <div
              key={region.name}
              className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white px-4 py-4"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div>
                <p className="text-sm font-semibold text-brand-800">{region.name}</p>
                <p className="text-xs text-brand-500">Latency {region.latencyMs}ms</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-600">
                <SignalHigh className="h-4 w-4 text-brand-400" />
                {region.signalQuality}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
