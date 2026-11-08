import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Beaker, Building2, CheckCircle2, ChevronDown, CircleHelp, FlaskConical, Layers3, Plus, Sparkles } from "lucide-react";

import { createLabDepartment, initializeWorkbookDepartments } from "@/app/(workspace)/departments/actions";
import { getDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import { mediLabCatalogueSource } from "@/lib/medilab-catalogue-source";
import { catalogueDepartmentDefaults, normalizeDepartmentName, recommendedDepartmentCode } from "@/lib/department-catalogue";
import { normalizeCatalogueName } from "@/lib/catalogue-import";
import type { CatalogueTest } from "@/lib/catalogue";
import type { DepartmentRecord } from "@/lib/models";

type DepartmentTest = CatalogueTest & { enabled?: boolean };

const inputClass = "h-10 w-full border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500";

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, database, params] = await Promise.all([getCurrentUser(), getDatabase(), searchParams]);
  if (user?.role !== "Administrator") redirect("/dashboard");

  const [departments, definitions] = await Promise.all([
    database.collection<DepartmentRecord>("departments").find().sort({ name: 1 }).toArray(),
    database.collection<DepartmentTest>("testDefinitions").find().sort({ panel: 1, name: 1 }).toArray(),
  ]);
  const departmentByCode = new Map(departments.map((department) => [department.code, department]));
  const sourceGroups = new Map<string, Map<string, Array<{ sourceCode: string; name: string }>>>();
  const sourcePanelNames = new Map<string, string>();
  for (const row of mediLabCatalogueSource) {
    const key = `${row.category}::${row.subcategory}`;
    if (row.resultType === "Profile" && !sourcePanelNames.has(key)) sourcePanelNames.set(key, row.name);
  }
  for (const row of mediLabCatalogueSource) {
    if (row.resultType === "Profile") continue;
    const departmentCode = recommendedDepartmentCode(row);
    const groups = sourceGroups.get(departmentCode) ?? new Map<string, Array<{ sourceCode: string; name: string }>>();
    const panel = row.sourceCode.startsWith("ANC-") || row.sourceCode.startsWith("POC-")
      ? row.name
      : sourcePanelNames.get(`${row.category}::${row.subcategory}`) ?? row.subcategory;
    groups.set(panel, [...(groups.get(panel) ?? []), { sourceCode: row.sourceCode, name: row.name }]);
    sourceGroups.set(departmentCode, groups);
  }
  const panelGroups = new Map<string, DepartmentTest[]>();
  for (const test of definitions.filter((item) => !item.panelHeaderOnly)) {
    const code = test.departmentCode ?? "__unassigned__";
    panelGroups.set(`${code}::${test.panel}`, [...(panelGroups.get(`${code}::${test.panel}`) ?? []), test]);
  }
  const createdDefaults = typeof params.created === "string" ? params.created : "0";
  const notice = typeof params.notice === "string" ? params.notice : "";
  const error = typeof params.error === "string" ? params.error : "";
  const defaultDepartmentCount = catalogueDepartmentDefaults.filter((definition) => departments.some((item) => [definition.name, ...definition.aliases].some((name) => normalizeDepartmentName(name) === normalizeDepartmentName(item.name)))).length;
  const unassignedTests = definitions.filter((test) => !test.panelHeaderOnly && (!test.departmentCode || !departmentByCode.get(test.departmentCode)?.active));
  const categoryNames = new Set(catalogueDepartmentDefaults.flatMap((definition) => [definition.name, ...definition.aliases].map(normalizeDepartmentName)));
  const displayDepartments = [
    ...catalogueDepartmentDefaults.map((definition) => {
      const existing = departments.find((item) => [definition.name, ...definition.aliases].some((name) => normalizeDepartmentName(name) === normalizeDepartmentName(item.name)));
      return existing
        ? { code: existing.code, name: existing.name, active: existing.active, kind: definition.kind, isWorkbookDefault: true, persisted: true }
        : { code: definition.code, name: definition.name, active: false, kind: definition.kind, isWorkbookDefault: true, persisted: false };
    }),
    ...departments.filter((item) => !categoryNames.has(normalizeDepartmentName(item.name))).map((item) => ({ code: item.code, name: item.name, active: item.active, kind: item.departmentKind ?? "PERFORMING" as const, isWorkbookDefault: false, persisted: true })),
  ];

  const errors: Record<string, string> = {
    validation: "Enter a valid department code and name.",
    "duplicate-department": "A department with that code or name already exists.",
    "reserved-department-name": "This is a standard department or workflow category. Use the standard defaults, or assign point-of-care tests to their performing department.",
  };

  return <main className="mx-auto max-w-7xl space-y-6 pb-10 text-slate-800">
    <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-end">
      <div>
        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0049B7]"><Building2 size={15} /> Laboratory / Structure</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#073F9F] sm:text-[28px]">Departments and test structure</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Organize the catalogue as department → test panel → result fields. Result fields are the individual subtests staff enter and review.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/catalogue" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"><FlaskConical size={15} /> Manage subtests</Link>
        <Link href="/catalogue/import" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#073F9F] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#102b61]"><ArrowRight size={15} color="white" /> <span className="text-white">Import workbook tests </span></Link>
      </div>
    </header>

    {notice === "defaults-ready" && <div role="status" className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={17} /> Department defaults are ready. {createdDefaults} new record{createdDefaults === "1" ? " was" : "s were"} created; matching existing records were reused.</div>}
    {notice === "department-created" && <div role="status" className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Department created and available to catalogue, orders, and reagent workflows.</div>}
    {error && errors[error] && <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errors[error]}</div>}

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-5 shadow-sm sm:flex-row sm:items-center">
        <div className="flex gap-3.5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-700 shadow-sm"><Sparkles size={19} /></span><div><h2 className="text-sm font-semibold text-blue-950">Department defaults <span className="font-medium text-blue-700">· {catalogueDepartmentDefaults.length} records</span></h2><p className="mt-1 max-w-2xl text-xs leading-5 text-blue-900">Add missing performing departments and the antenatal order-group using stable codes. Point-of-care remains workflow metadata, not a department.</p><p className="mt-2 text-[11px] font-semibold text-blue-800">{defaultDepartmentCount} of {catalogueDepartmentDefaults.length} already exist</p></div></div>
        <form action={initializeWorkbookDepartments}><button type="submit" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#073F9F] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-900"><CheckCircle2 size={14} /> Add missing defaults</button></form>
      </div>
      <form action={createLabDepartment} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EAF9FE] text-[#073F9F]"><Plus size={16} /></span><div><h2 className="text-sm font-semibold text-[#073F9F]">Create a department</h2><p className="mt-0.5 text-[10px] text-slate-500">Add a custom department to the catalogue</p></div></div>
        <label className="grid gap-1 text-xs font-medium text-slate-600">Code<input className={inputClass} name="code" required maxLength={24} placeholder="e.g. HISTO" /></label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">Department name<input className={inputClass} name="name" required maxLength={100} placeholder="e.g. Histopathology" /></label>
        <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"><Plus size={15} /> Create department</button>
      </form>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "Active departments", value: departments.filter((item) => item.active).length, icon: Building2, tone: "blue" },
        { label: "Test panels", value: new Set(definitions.map((item) => item.panel)).size, icon: Layers3, tone: "cyan" },
        { label: "Unassigned fields", value: unassignedTests.length, icon: CircleHelp, tone: "amber" },
        { label: "Enabled result fields", value: definitions.filter((item) => item.enabled && !item.panelHeaderOnly).length, icon: Beaker, tone: "green" },
      ].map(({ label, value, icon: Icon, tone }) => <article key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "cyan" ? "bg-cyan-50 text-cyan-700" : "bg-blue-50 text-blue-700"}`}><Icon size={18} /></span><div><p className="text-xl font-semibold leading-none tracking-tight text-slate-900">{value}</p><p className="mt-1.5 text-[11px] font-medium text-slate-500">{label}</p></div></article>)}
    </section>

    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-end"><div><h2 className="text-base font-semibold text-[#073F9F]">Department catalogue</h2><p className="mt-1 text-xs leading-5 text-slate-500">A panel groups related subtests. The same department records are used by order routing, worklists, and reagent definitions.</p></div><span className="text-[11px] font-medium text-slate-400">{displayDepartments.length} departments</span></div>
      {displayDepartments.map((department) => {
        const departmentPanels = department.persisted ? [...panelGroups.entries()].filter(([key]) => key.startsWith(`${department.code}::`)) : [];
        const standardDepartment = catalogueDepartmentDefaults.find((item) => [item.name, ...item.aliases].some((name) => normalizeDepartmentName(name) === normalizeDepartmentName(department.name)));
        const sourcePreview = sourceGroups.get(standardDepartment?.code ?? department.code);
        const previewGroups = sourcePreview ? [...sourcePreview.entries()].map(([panel, tests]) => ({
          panel,
          tests: tests.filter((sourceTest) => !definitions.some((definition) =>
            definition.sourceTestCode === sourceTest.sourceCode
            || (normalizeCatalogueName(definition.panel) === normalizeCatalogueName(panel) && normalizeCatalogueName(definition.name) === normalizeCatalogueName(sourceTest.name)),
          )),
        })).filter((group) => group.tests.length) : [];
        const sourceCount = sourcePreview ? [...sourcePreview.values()].reduce((sum, tests) => sum + tests.length, 0) : 0;
        return <details key={department.code} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40 transition hover:border-slate-300">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 sm:px-5">
            <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-[#073F9F]"><Building2 size={18} /></span><div><h3 className="text-sm font-semibold text-[#073F9F]">{department.name}</h3><p className="mt-1 text-[10px] text-slate-500">{department.persisted ? `${department.code} · ${department.kind === "ORDER_GROUP" ? "Order group" : department.active ? "Active" : "Inactive"}` : `Workbook default · ${department.kind === "ORDER_GROUP" ? "order group" : "not created yet"}`}</p></div></div>
            <div className="flex flex-wrap items-center gap-2 text-[10px]"><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">{departmentPanels.length} panels</span>{sourceCount > 0 && <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 font-medium text-blue-800">{sourceCount} workbook entries</span>}<ChevronDown size={16} className="ml-1 text-slate-400 transition-transform group-open:rotate-180" /></div>
          </summary>
          <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 p-3 sm:p-4">
            {departmentPanels.length > 0 ? departmentPanels.map(([key, tests]) => {
              const panel = key.slice(department.code.length + 2);
              return <article key={key} className="overflow-hidden rounded border border-slate-200 bg-white">
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5"><div className="flex min-w-0 items-center gap-2"><Layers3 size={15} className="shrink-0 text-cyan-600" /><div><h4 className="truncate text-xs font-semibold text-slate-800">{panel}</h4><p className="text-[10px] text-slate-500">Main test panel</p></div></div><span className="shrink-0 text-[10px] text-slate-500">{tests.length} result field{tests.length === 1 ? "" : "s"}</span></header>
                <ul className="divide-y divide-slate-100 sm:grid sm:grid-cols-2 sm:divide-y-0">{tests.map((test) => <li key={test.code} className="flex items-start justify-between gap-3 px-3 py-2.5 sm:border-b sm:border-slate-100"><div className="flex min-w-0 gap-2"><Beaker size={13} className="mt-0.5 shrink-0 text-slate-400" /><div className="min-w-0"><p className="text-xs font-medium text-slate-800">{test.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{test.kind} result{test.unit ? ` · ${test.unit}` : ""}</p></div></div><span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${test.enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{test.enabled ? "ACTIVE" : "SETUP"}</span></li>)}</ul>
              </article>;
            }) : <div className="flex gap-2 rounded border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500"><CircleHelp size={15} className="mt-0.5 shrink-0" /><p>No configured panels yet. Import the workbook tests or add a panel and its result fields in the test catalogue.</p></div>}

            {previewGroups.length > 0 && <section className="space-y-2 rounded border border-blue-100 bg-blue-50/60 p-3"><div><h4 className="text-xs font-semibold text-blue-950">Workbook panels and tests</h4><p className="mt-0.5 text-[10px] text-blue-800">Mapped to this department · import to add them to the editable catalogue.</p></div>{previewGroups.map((group) => <article key={group.panel} className="overflow-hidden rounded border border-blue-100 bg-white"><header className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2"><div className="flex min-w-0 items-center gap-2"><Layers3 size={14} className="shrink-0 text-cyan-600" /><h5 className="truncate text-xs font-semibold text-slate-800">{group.panel}</h5></div><span className="shrink-0 text-[9px] font-medium text-blue-700">Workbook default</span></header><ul className="divide-y divide-slate-100 sm:grid sm:grid-cols-2 sm:divide-y-0">{group.tests.map((test) => <li key={test.sourceCode} className="flex items-start gap-2 px-3 py-2 text-[11px] text-slate-700 sm:border-b sm:border-slate-100"><Beaker size={12} className="mt-0.5 shrink-0 text-slate-400" /><span>{test.name}</span></li>)}</ul></article>)}<Link href="/catalogue/import" className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-800 underline underline-offset-2">Import these workbook tests <ArrowRight size={12} /></Link></section>}
          </div>
        </details>;
      })}
      {unassignedTests.length > 0 && <div className="border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-semibold text-amber-900">Unassigned result fields</h3><p className="mt-1 text-xs leading-5 text-amber-800">{unassignedTests.length} existing catalogue entries are not linked to an active department. Assign them in the Test Catalogue so they appear in the correct department and worklist.</p><Link href="/catalogue" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 underline underline-offset-2">Review catalogue assignments <ArrowRight size={13} /></Link></div>}
    </section>
  </main>;
}
