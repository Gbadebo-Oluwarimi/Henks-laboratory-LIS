import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { lockedModules } from "@/lib/locked-modules";

export default async function LockedModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  const moduleEntry = lockedModules.find((item) => item.slug === slug);
  if (!moduleEntry) notFound();

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">ADVANCED LIS / MODULE ACCESS</p><h1>{moduleEntry.label}</h1><p className="page-subtitle">{moduleEntry.description}</p></div>
      </div>
      <section className="locked-module-screen" aria-labelledby="locked-module-title">
        <span className="locked-module-icon"><LockKeyhole size={24} /></span>
        <p className="locked-module-status">LOCKED MODULE</p>
        <h2 id="locked-module-title">Not enabled for this workspace</h2>
        <p>{moduleEntry.label} is listed for future configuration. No records or actions are available in this module yet.</p>
        <Link className="button button-secondary" href="/dashboard"><ArrowLeft size={15} /> Back to overview</Link>
      </section>
    </>
  );
}