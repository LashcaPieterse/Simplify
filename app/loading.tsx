export default function Loading() {
  return <div className="mx-auto max-w-7xl animate-pulse px-5 py-16 sm:px-6 lg:px-8" aria-label="Loading page"><div className="h-4 w-36 rounded bg-brand-100" /><div className="mt-5 h-14 max-w-3xl rounded-2xl bg-brand-100" /><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-64 rounded-3xl bg-brand-50" />)}</div></div>;
}
