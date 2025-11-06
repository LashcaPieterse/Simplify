import type { StepsSection } from "@/lib/sanity.queries";

export function Steps({ section }: { section: StepsSection }) {
  return (
    <section id="how" className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
      <div className="flex flex-col gap-6 rounded-[2rem] border border-brand-100/80 bg-white p-10 shadow-card lg:flex-row lg:items-center lg:gap-16">
        <div className="flex-1 space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Effortless onboarding</p>
          <h2 className="font-display text-3xl text-brand-900 sm:text-4xl">{section.title}</h2>
          <p className="text-base text-brand-700">
            Follow the guided flow from checkout to activation. Every step adapts to your device and destination for a
            stress-free setup.
          </p>
        </div>
        <ol className="flex-1 space-y-4">
          {section.steps.map((step) => (
            <li
              key={step.stepNo}
              className="relative overflow-hidden rounded-2xl border border-brand-100/80 bg-brand-50/60 p-5 pl-16"
            >
              <span className="absolute left-5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-brand-600 shadow-subtle">
                {step.stepNo}
              </span>
              <p className="font-semibold text-brand-800">{step.title}</p>
              <p className="text-sm text-brand-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
