import { FlaskConical } from "lucide-react";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 ${className}`} />;
}

export default function WorkspaceLoading() {
  return (
    <main className="min-w-0 space-y-6 pb-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading laboratory workspace</span>
      <header className="flex items-center gap-3 border-b border-slate-200 pb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-blue-100 bg-blue-50 text-blue-700">
          <FlaskConical size={21} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-6 w-48 max-w-full" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <div className="flex items-center gap-3 border border-slate-200 bg-white p-4" key={item}>
            <Skeleton className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-2.5 w-20 max-w-full" />
              <Skeleton className="h-5 w-12" />
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden border border-slate-200 bg-white" aria-hidden="true">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-0 divide-y divide-slate-100">
          {[0, 1, 2, 3, 4].map((item) => (
            <div className="grid grid-cols-3 gap-4 px-4 py-4 sm:grid-cols-5" key={item}>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="hidden h-3 w-4/5 sm:block" />
              <Skeleton className="hidden h-3 w-2/3 sm:block" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
