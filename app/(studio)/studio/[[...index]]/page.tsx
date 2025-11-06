'use client';

export default function StudioPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold text-brand-900">Studio unavailable</h1>
      <p className="max-w-xl text-sm text-brand-600">
        The Sanity Studio is disabled in this build. Configure the Sanity credentials and dependencies locally to enable the
        full authoring experience.
      </p>
    </div>
  );
}
