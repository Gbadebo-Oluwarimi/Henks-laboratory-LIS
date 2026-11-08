import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FlaskConical, Home, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found | Henks Medical Limited",
  description: "The page you requested could not be found.",
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-[#f5f8fc] px-4 py-12 text-slate-800 sm:px-6">
      <div className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-cyan-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -right-24 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl" />

      <div className="relative w-full max-w-2xl">
        <header className="mb-8 flex items-center justify-center">
          <Link href="/" aria-label="Henks Medical Limited home" className="rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100">
            <Image src="/henkslogo.webp" alt="Henks Medical Limited" width={320} height={80} priority />
          </Link>
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_80px_-32px_rgba(24,55,121,0.28)]">
          <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-[#f0f8fd] via-white to-[#f3faed] px-6 py-10 text-center sm:px-12 sm:py-14">
            <div className="absolute -right-6 -top-10 h-40 w-40 rounded-full border-[18px] border-white/70" />
            <div className="absolute -bottom-12 -left-5 h-36 w-36 rounded-full border-[16px] border-cyan-100/40" />
            <div className="relative mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-blue-100 bg-white text-[#073F9F] shadow-sm">
              <FlaskConical size={28} strokeWidth={1.7} />
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-[#FE1625] text-white"><Search size={10} strokeWidth={3} /></span>
            </div>
            <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] text-[#0049B7]">Error 404</p>
            <h1 className="relative mt-2 text-3xl font-semibold tracking-tight text-[#073F9F] sm:text-4xl">This page isn’t on the map</h1>
            <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">The page may have moved, or the address may be incorrect. Let’s get you back to the laboratory workspace.</p>
          </div>

          <div className="flex flex-col items-center gap-3 px-6 py-6 sm:flex-row sm:justify-center sm:px-10">
            <Link href="/dashboard" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#073F9F] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#102b61] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:w-auto">
              <Home size={16} /> Go to workspace <ArrowRight size={15} />
            </Link>
            <Link href="/sign-in" className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-100 sm:w-auto">
              Sign in
            </Link>
          </div>
        </section>

        <p className="mt-6 text-center text-[11px] font-medium tracking-wide text-slate-400">HENKS MEDICAL LIMITED</p>
      </div>
    </main>
  );
}
