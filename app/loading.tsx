export default function Loading() {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-5 py-2">
      <div className="h-8 w-48 rounded-xl bg-white/10" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
        {Array.from({ length: 16 }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.035]"
          >
            <div className="aspect-[2/3] bg-white/[0.07]" />
            <div className="space-y-2 p-2">
              <div className="h-3 w-4/5 rounded bg-white/10" />
              <div className="h-2.5 w-1/2 rounded bg-white/[0.07]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
