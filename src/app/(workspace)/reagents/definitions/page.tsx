import Link from "next/link";
import { ArrowRight, Plus, Search } from "lucide-react";
import { getDatabase } from "@/lib/mongodb";
import { hasPermission, requirePermission } from "@/lib/session";
import type { DepartmentRecord, ReagentRecord } from "@/lib/models";
import { createReagent } from "@/app/(workspace)/reagents/actions";
import { PaginationControls } from "@/app/(workspace)/pagination";
import { ReagentHeader, ReagentTabs, reagentButtonClass, reagentErrorMessage, reagentInputClass, reagentLabelClass } from "@/app/(workspace)/reagents/components";
import { ToastNotification } from "@/app/(workspace)/toast-notification";

const pageSize = 20;
const categories = ["Chemistry", "Haematology", "Microbiology", "Immunology", "Serology", "Coagulation", "Molecular Biology", "Other"] as const;

export default async function ReagentDefinitionsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; error?: string | string[]; notice?: string | string[] }> }) {
  const user = await requirePermission("reagents:view");
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().slice(0, 100) ?? "";
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const database = await getDatabase();
  const departments = await database.collection<DepartmentRecord>("departments").find({ active: true, departmentKind: { $ne: "ORDER_GROUP" } }).sort({ name: 1 }).toArray();
  const query = q ? { $or: [{ name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { code: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { manufacturer: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }] } : {};
  const reagentsCollection = database.collection<ReagentRecord>("reagents");
  const [total, reagents] = await Promise.all([
    reagentsCollection.countDocuments(query),
    reagentsCollection.find(query).sort({ name: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
  ]);
  const departmentById = new Map(departments.map((department) => [department._id.toHexString(), department.name]));
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const noticeCode = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const notice = noticeCode === "created" ? "Reagent definition created." : noticeCode === "updated" ? "Reagent definition updated." : null;
  const canManage = hasPermission(user, "reagents:manage");
  const error = reagentErrorMessage(errorCode);

  return (
    <main className="min-w-0 space-y-5 pb-8 text-slate-800">
      {notice && <ToastNotification message={notice} />}
      {error && <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <ReagentHeader title="Reagent definitions" description="Maintain product-level reagent details separately from the physical lots received by the laboratory." action={<Link href="/reagents/lots/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-500 px-4 text-sm font-semibold text-white hover:bg-blue-600"><Plus size={15} /> Receive lot</Link>} />
      <ReagentTabs active="Reagents" />

      {canManage && <details className="border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4"><span className="flex items-center gap-2 text-sm font-semibold text-[#073F9F]"><Plus size={16} /> Add reagent definition</span><span className="text-xs text-slate-500">Product setup · Admin permission</span></summary>
        {departments.length ? <form action={createReagent} className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className={reagentLabelClass}>Code<input className={reagentInputClass} name="code" required maxLength={40} placeholder="e.g. GLU-REAG" /></label>
          <label className={reagentLabelClass}>Name<input className={reagentInputClass} name="name" required maxLength={120} /></label>
          <label className={reagentLabelClass}>Category<select className={reagentInputClass} name="category" defaultValue="Chemistry">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className={reagentLabelClass}>Department<select className={reagentInputClass} name="departmentId" required defaultValue=""><option value="" disabled>Select department</option>{departments.map((department) => <option key={department._id.toHexString()} value={department._id.toHexString()}>{department.name}</option>)}</select></label>
          <label className={reagentLabelClass}>Manufacturer<input className={reagentInputClass} name="manufacturer" maxLength={120} /></label>
          <label className={reagentLabelClass}>Catalogue number<input className={reagentInputClass} name="catalogueNumber" maxLength={80} /></label>
          <label className={reagentLabelClass}>Unit of issue<input className={reagentInputClass} name="unitOfIssue" required maxLength={40} placeholder="bottle, kit, pack" /></label>
          <label className={reagentLabelClass}>Reorder level<input className={reagentInputClass} name="reorderLevel" type="number" min="0" step="any" defaultValue="0" required /></label>
          <label className={reagentLabelClass}>Minimum stock<input className={reagentInputClass} name="minimumStock" type="number" min="0" step="any" /></label>
          <label className={reagentLabelClass}>Maximum stock<input className={reagentInputClass} name="maximumStock" type="number" min="0" step="any" /></label>
          <label className={reagentLabelClass}>In-use stability (days)<input className={reagentInputClass} name="inUseStabilityDays" type="number" min="1" max="3650" step="1" /><span className="mt-1 block text-[10px] text-slate-400">Only enter the stability from your laboratory procedure.</span></label>
          <label className={reagentLabelClass}>Default storage condition<input className={reagentInputClass} name="defaultStorageCondition" maxLength={120} placeholder="Use configured manufacturer guidance" /></label>
          <label className={`${reagentLabelClass} sm:col-span-2 xl:col-span-4`}>Description<textarea className="mt-1 block min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" name="description" maxLength={500} /></label>
          <div className="sm:col-span-2 xl:col-span-4"><button className={reagentButtonClass} type="submit"><Plus size={14} /> Save definition</button></div>
        </form> : <p className="border-t border-slate-200 px-4 py-5 text-sm text-slate-600">Create a department under Reagent settings before adding reagent definitions.</p>}
      </details>}

      <section className="overflow-hidden border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center">
          <div><h2 className="text-sm font-semibold text-[#073F9F]">All reagent products</h2><p className="mt-1 text-xs text-slate-500">{total} definitions · lot history is retained when a definition is deactivated.</p></div>
          <form className="flex gap-2" action="/reagents/definitions" method="get"><label className="sr-only" htmlFor="reagent-search">Search reagents</label><input id="reagent-search" className="h-9 w-64 max-w-[65vw] border border-slate-200 px-3 text-xs outline-none focus:border-blue-500" name="q" defaultValue={q} placeholder="Search name, code, manufacturer" /><button className="inline-flex h-9 items-center gap-2 border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"><Search size={13} /> Search</button></form>
        </div>
        {reagents.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Reagent / code</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Manufacturer</th><th className="px-4 py-3">Reorder at</th><th className="px-4 py-3">State</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{reagents.map((reagent) => <tr key={reagent._id.toHexString()}><td className="px-4 py-3"><Link href={`/reagents/definitions/${reagent._id}`} className="font-semibold text-[#073F9F] hover:underline">{reagent.name}</Link><p className="mt-0.5 text-[10px] text-slate-400">{reagent.code}</p></td><td className="px-4 py-3 text-xs text-slate-600">{reagent.category}</td><td className="px-4 py-3 text-xs text-slate-600">{departmentById.get(reagent.departmentId.toHexString()) ?? "Department archived"}</td><td className="px-4 py-3 text-xs text-slate-600">{reagent.manufacturer || "—"}</td><td className="px-4 py-3 text-xs text-slate-600">{reagent.reorderLevel} {reagent.unitOfIssue}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${reagent.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{reagent.active ? "ACTIVE" : "INACTIVE"}</span></td><td className="px-4 py-3 text-right"><Link href={`/reagents/definitions/${reagent._id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">Details <ArrowRight size={13} /></Link></td></tr>)}</tbody></table><PaginationControls basePath="/reagents/definitions" currentPage={page} totalItems={total} pageSize={pageSize} query={{ q }} itemLabel="reagents" /></div> : <p className="px-4 py-12 text-center text-sm text-slate-500">{q ? "No reagent definitions matched that search." : "No reagent products have been defined yet."}</p>}
      </section>
    </main>
  );
}
