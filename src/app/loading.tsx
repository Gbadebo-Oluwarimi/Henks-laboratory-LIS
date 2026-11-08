import { FlaskConical } from "lucide-react";
import { labBranding } from "@/lib/branding";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-5" aria-busy="true" aria-live="polite">
      <section className="w-full max-w-sm border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center border border-blue-100 bg-blue-50 text-blue-700">
          <FlaskConical size={26} strokeWidth={1.7} />
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">{labBranding.name}</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">Preparing your workspace</h1>
        <p className="mt-1 text-sm text-slate-500">Please wait while we securely load your laboratory tools.</p>
        <span className="sr-only">Loading</span>
      </section>
    </main>
  );
}
