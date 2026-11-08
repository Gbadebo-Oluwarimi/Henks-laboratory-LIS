import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { importMediLabCatalogue } from "@/app/(workspace)/catalogue/import/actions";
import { getDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { catalogueDepartmentDefaults, recommendedDepartmentCode } from "@/lib/department-catalogue";
import { malariaSourceCodesConsolidatedIntoPanel, mediLabWorkbookName } from "@/lib/catalogue-import";
import { mediLabCatalogueSource } from "@/lib/medilab-catalogue-source";
import type { DepartmentRecord } from "@/lib/models";

export default async function CatalogueImportPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[]; created?: string | string[]; matched?: string | string[] }>;
}) {
  const [user, database, params] = await Promise.all([getCurrentUser(), getDatabase(), searchParams]);
  if (user?.role !== "Administrator") redirect("/dashboard");
  const departments = await database.collection<DepartmentRecord>("departments").find({ active: true }).sort({ name: 1 }).toArray();
  const existing = await database.collection<{ sourceWorkbook?: string; sourceTestCode?: string }>("testDefinitions").find({ sourceWorkbook: mediLabWorkbookName }).toArray();
  const importedCodes = new Set(existing.map((item) => item.sourceTestCode));
  for (const sourceCode of malariaSourceCodesConsolidatedIntoPanel) importedCodes.add(sourceCode);
  const categories = [...new Set(mediLabCatalogueSource.map((item) => item.category))];
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const created = Array.isArray(params.created) ? params.created[0] : params.created;
  const matched = Array.isArray(params.matched) ? params.matched[0] : params.matched;
  const notices = notice === "imported";

  return <main className="mx-auto max-w-6xl space-y-5 pb-10 text-slate-800">
    <header><Link href="/departments" className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#073F9F]"><ArrowLeft size={14} /> Back to departments</Link><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0049B7]">Catalogue / Integration</p><h1 className="text-2xl font-semibold tracking-tight text-[#073F9F]">Add Henks lab tests</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Review the workbook source and import its catalogue entries into their recommended departments. New entries stay disabled until they are configured and approved locally.</p></header>
    {notices && <div role="status" className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Import completed: {created ?? "0"} added and {matched ?? "0"} matched to existing tests.</div>}
  
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-[#073F9F]">Department mapping</h2><p className="mt-1 text-xs text-slate-500">Workbook rows are placed under the recommended performing department; existing active departments with matching names are reused.</p></div>
      <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => {
        const row = mediLabCatalogueSource.find((item) => item.category === category)!;
        const suggestedCode = recommendedDepartmentCode(row);
        const suggested = catalogueDepartmentDefaults.find((item) => item.code === suggestedCode);
        const department = departments.find((item) => item.code === suggestedCode || item.name.toLowerCase() === suggested?.name.toLowerCase());
        const count = mediLabCatalogueSource.filter((item) => item.category === category).length;
        return <div key={category} className="bg-white p-3"><p className="text-xs font-semibold text-slate-700">{category}</p><p className="mt-1 text-[10px] text-slate-500">{count} tests · {department?.name ?? suggested?.name ?? category}</p></div>;
      })}</div>
    </section>
    <section className="overflow-hidden border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-semibold text-[#073F9F]">Workbook catalogue</h2><p className="mt-1 text-xs text-slate-500">{importedCodes.size} of {mediLabCatalogueSource.length} source rows are already linked.</p></div><form action={importMediLabCatalogue}><button type="submit" className="h-9 rounded bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">Import / update workbook catalogue</button></form></div>
      <div className="max-h-[560px] overflow-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Source code</th><th className="px-3 py-2">Test / panel</th><th className="px-3 py-2">Category / group</th><th className="px-3 py-2">Department</th><th className="px-3 py-2">Import status</th></tr></thead><tbody className="divide-y divide-slate-100">{mediLabCatalogueSource.map((row) => {
        const target = catalogueDepartmentDefaults.find((item) => item.code === recommendedDepartmentCode(row));
        return <tr key={row.sourceCode}><td className="px-3 py-2 font-mono text-[10px] text-slate-500">{row.sourceCode}</td><td className="px-3 py-2 font-medium text-slate-700">{row.name}</td><td className="px-3 py-2 text-slate-500">{row.category} / {row.subcategory}</td><td className="px-3 py-2 text-slate-600">{target?.name ?? row.category}</td><td className="px-3 py-2">{importedCodes.has(row.sourceCode) ? <span className="text-emerald-700">Already linked</span> : <span className="text-blue-700">Ready to import</span>}</td></tr>;
      })}</tbody></table></div>
    </section>
  </main>;
}
