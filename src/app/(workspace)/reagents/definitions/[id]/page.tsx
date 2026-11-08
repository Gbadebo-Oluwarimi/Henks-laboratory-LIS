import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Plus } from "lucide-react";
import { ObjectId } from "mongodb";

import { getDatabase } from "@/lib/mongodb";
import { hasPermission, requirePermission } from "@/lib/session";
import { lotEffectiveStatus, todayKey } from "@/lib/reagents";
import { formatDate } from "@/lib/presentation";
import type { DepartmentRecord, ReagentLotRecord, ReagentRecord, TestReagentRequirementRecord } from "@/lib/models";
import { createTestReagentRequirement, deleteTestReagentRequirement, toggleReagentActive, updateReagent } from "@/app/(workspace)/reagents/actions";
import { ReagentHeader, ReagentStatus, ReagentTabs, reagentButtonClass, reagentErrorMessage, reagentInputClass, reagentLabelClass, reagentSecondaryButtonClass } from "@/app/(workspace)/reagents/components";
import { ToastNotification } from "@/app/(workspace)/toast-notification";

const categories = ["Chemistry", "Haematology", "Microbiology", "Immunology", "Serology", "Coagulation", "Molecular Biology", "Other"] as const;

export default async function ReagentDefinitionDetails({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }> }) {
  const user = await requirePermission("reagents:view");
  const [{ id }, search, database] = await Promise.all([params, searchParams, getDatabase()]);
  if (!ObjectId.isValid(id)) notFound();
  const idObject = new ObjectId(id);
  const [reagent, departments, lots, requirements, tests] = await Promise.all([
    database.collection<ReagentRecord>("reagents").findOne({ _id: idObject }),
    database.collection<DepartmentRecord>("departments").find({ active: true, departmentKind: { $ne: "ORDER_GROUP" } }).sort({ name: 1 }).toArray(),
    database.collection<ReagentLotRecord>("reagentLots").find({ reagentId: idObject }).sort({ dateReceived: -1 }).limit(10).toArray(),
    database.collection<TestReagentRequirementRecord>("testReagentRequirements").find({ reagentId: idObject }).sort({ testCode: 1 }).toArray(),
    database.collection<{ code: string; name: string; panel: string; enabled: boolean; panelHeaderOnly?: boolean; requiresClinicalReview?: boolean; clinicalReviewStatus?: string; departmentCode?: string }>("testDefinitions").find({}).sort({ panel: 1, name: 1 }).toArray(),
  ]);
  if (!reagent) notFound();
  const errorCode = Array.isArray(search.error) ? search.error[0] : search.error;
  const noticeCode = Array.isArray(search.notice) ? search.notice[0] : search.notice;
  const notices: Record<string, string> = { created: "Reagent definition created.", updated: "Reagent definition updated.", activated: "Reagent definition activated.", deactivated: "Reagent definition deactivated.", "requirement-created": "Test requirement added." };
  const error = reagentErrorMessage(errorCode);
  const canManage = hasPermission(user, "reagents:manage");
  const availableLots = await database.collection<ReagentLotRecord>("reagentLots").find({ reagentId: idObject, status: { $in: ["APPROVED", "IN_USE"] } }).toArray();
  const today = todayKey();
  const availableQuantity = availableLots.reduce((sum, lot) => {
    const effectiveExpiry = lot.inUseExpiryDate && lot.inUseExpiryDate < lot.expiryDate ? lot.inUseExpiryDate : lot.expiryDate;
    return effectiveExpiry.toISOString().slice(0, 10) <= today ? sum : sum + lot.currentQuantity;
  }, 0);
  const activeTests = tests.filter((test) => !test.panelHeaderOnly && (test.enabled !== false || test.requiresClinicalReview === true));
  const departmentByCode = new Map(departments.map((department) => [department.code, department.name]));

  return (
    <main className="min-w-0 space-y-5 pb-8 text-slate-800">
      {noticeCode && notices[noticeCode] && <ToastNotification message={notices[noticeCode]} />}
      {error && <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex items-center justify-between gap-3"><Link href="/reagents/definitions" className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-[#073F9F]"><ArrowLeft size={14} /> Back to reagents</Link><Link href="/reagents/lots/new" className={reagentSecondaryButtonClass}><Plus size={14} /> Receive lot</Link></div>
      <ReagentHeader title={reagent.name} description={`${reagent.code} · ${reagent.category} · ${reagent.unitOfIssue}`} action={canManage ? <form action={toggleReagentActive}><input type="hidden" name="reagentId" value={id} /><button className={reagent.active ? reagentSecondaryButtonClass : reagentButtonClass} type="submit">{reagent.active ? "Deactivate definition" : "Reactivate definition"}</button></form> : undefined} />
      <ReagentTabs active="Reagents" />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <article className="border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase tracking-wide text-slate-400">Available stock</p><p className="mt-2 text-xl font-semibold text-[#073F9F]">{availableQuantity} <span className="text-xs font-medium">{reagent.unitOfIssue}</span></p></article>
        <article className="border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase tracking-wide text-slate-400">Reorder level</p><p className="mt-2 text-xl font-semibold text-[#073F9F]">{reagent.reorderLevel} <span className="text-xs font-medium">{reagent.unitOfIssue}</span></p></article>
        <article className="border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase tracking-wide text-slate-400">Lots recorded</p><p className="mt-2 text-xl font-semibold text-[#073F9F]">{await database.collection<ReagentLotRecord>("reagentLots").countDocuments({ reagentId: idObject })}</p></article>
        <article className="border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase tracking-wide text-slate-400">In-use stability</p><p className="mt-2 text-xl font-semibold text-[#073F9F]">{reagent.inUseStabilityDays ? `${reagent.inUseStabilityDays} days` : "Not set"}</p></article>
      </section>

      {canManage && <details className="border border-slate-200 bg-white"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#073F9F]">Edit reagent details</summary><form action={updateReagent} className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <input type="hidden" name="reagentId" value={id} />
        <label className={reagentLabelClass}>Code (fixed)<input className={`${reagentInputClass} bg-slate-50`} name="code" defaultValue={reagent.code} readOnly /></label>
        <label className={reagentLabelClass}>Name<input className={reagentInputClass} name="name" defaultValue={reagent.name} required maxLength={120} /></label>
        <label className={reagentLabelClass}>Category<select className={reagentInputClass} name="category" defaultValue={reagent.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className={reagentLabelClass}>Department<select className={reagentInputClass} name="departmentId" defaultValue={reagent.departmentId.toHexString()} required>{departments.map((department) => <option key={department._id.toHexString()} value={department._id.toHexString()}>{department.name}</option>)}</select></label>
        <label className={reagentLabelClass}>Manufacturer<input className={reagentInputClass} name="manufacturer" defaultValue={reagent.manufacturer} maxLength={120} /></label>
        <label className={reagentLabelClass}>Catalogue number<input className={reagentInputClass} name="catalogueNumber" defaultValue={reagent.catalogueNumber} maxLength={80} /></label>
        <label className={reagentLabelClass}>Unit of issue<input className={reagentInputClass} name="unitOfIssue" defaultValue={reagent.unitOfIssue} required maxLength={40} /></label>
        <label className={reagentLabelClass}>Reorder level<input className={reagentInputClass} name="reorderLevel" type="number" min="0" step="any" defaultValue={reagent.reorderLevel} required /></label>
        <label className={reagentLabelClass}>Minimum stock<input className={reagentInputClass} name="minimumStock" type="number" min="0" step="any" defaultValue={reagent.minimumStock} /></label>
        <label className={reagentLabelClass}>Maximum stock<input className={reagentInputClass} name="maximumStock" type="number" min="0" step="any" defaultValue={reagent.maximumStock} /></label>
        <label className={reagentLabelClass}>In-use stability (days)<input className={reagentInputClass} name="inUseStabilityDays" type="number" min="1" max="3650" step="1" defaultValue={reagent.inUseStabilityDays} /><span className="mt-1 block text-[10px] text-slate-400">Enter only a stability period defined by your lab.</span></label>
        <label className={reagentLabelClass}>Default storage condition<input className={reagentInputClass} name="defaultStorageCondition" defaultValue={reagent.defaultStorageCondition} maxLength={120} /></label>
        <label className={`${reagentLabelClass} sm:col-span-2 xl:col-span-4`}>Description<textarea className="mt-1 block min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" name="description" defaultValue={reagent.description} maxLength={500} /></label>
        <button className={`${reagentButtonClass} sm:col-span-2 xl:col-span-4 sm:justify-self-start`} type="submit">Save reagent details</button>
      </form></details>}

      <section className="overflow-hidden border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-[#073F9F]">Test requirements</h2><p className="mt-1 text-xs text-slate-500">Associate this reagent with catalogue tests and define its role. Consumption quantities are not inferred.</p></div>
        {requirements.length ? <div className="divide-y divide-slate-100">{requirements.map((requirement) => {
          const definition = tests.find((test) => test.code === requirement.testCode);
          return <div key={requirement._id.toHexString()} className="flex flex-col justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center"><div><p className="text-sm font-medium text-slate-800">{definition?.name ?? requirement.testCode} <span className="text-xs text-slate-400">· {definition?.panel ?? "Test"}</span></p><p className="mt-1 text-[10px] text-slate-500">{requirement.role} · {requirement.required ? "Required" : "Optional"}{requirement.quantityPerTest ? ` · ${requirement.quantityPerTest} ${requirement.unit ?? reagent.unitOfIssue} per test (configured)` : " · Usage quantity not configured"}</p></div>{canManage && <form action={deleteTestReagentRequirement}><input type="hidden" name="requirementId" value={requirement._id.toHexString()} /><button className="text-xs font-semibold text-red-700 underline decoration-red-200 underline-offset-2">Remove link</button></form>}</div>;
        })}</div> : <p className="px-4 py-8 text-center text-sm text-slate-500">No tests are associated with this reagent.</p>}
        {canManage && <form action={createTestReagentRequirement} className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="reagentId" value={id} />
          <label className={reagentLabelClass}>Catalogue test<select className={reagentInputClass} name="testCode" required defaultValue=""><option value="" disabled>Select test</option>{activeTests.map((test) => <option key={test.code} value={test.code}>{departmentByCode.get(test.departmentCode ?? "") ?? "Unassigned"} · {test.name} · {test.panel}{test.requiresClinicalReview && test.clinicalReviewStatus !== "APPROVED" ? " · Pending clinical review" : ""}</option>)}</select></label>
          <label className={reagentLabelClass}>Material role<select className={reagentInputClass} name="role" defaultValue="REAGENT"><option>REAGENT</option><option>CALIBRATOR</option><option>CONTROL</option><option>OTHER</option></select></label>
          <label className={reagentLabelClass}>Quantity per test<input className={reagentInputClass} name="quantityPerTest" type="number" min="0.000001" step="any" /><span className="mt-1 block text-[10px] text-slate-400">Optional; enter only from a configured procedure.</span></label>
          <label className={reagentLabelClass}>Quantity unit<input className={reagentInputClass} name="unit" maxLength={40} placeholder={reagent.unitOfIssue} /></label>
          <div className="flex flex-col justify-end gap-2"><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="required" defaultChecked /> Required for test</label><button className={reagentButtonClass} type="submit"><Plus size={14} /> Add link</button></div>
        </form>}
      </section>

        <section className="overflow-hidden border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-semibold text-[#073F9F]">Recent lots</h2><p className="mt-1 text-xs text-slate-500">Each batch is tracked and approved independently.</p></div><Link href={`/reagents/lots?q=${encodeURIComponent(reagent.code)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">All lots <ExternalLink size={12} /></Link></div>{lots.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Lot number</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">On hand</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{lots.map((lot) => <tr key={lot._id.toHexString()}><td className="px-4 py-3"><Link href={`/reagents/lots/${lot._id}`} className="font-semibold text-[#073F9F] hover:underline">{lot.lotNumber}</Link></td><td className="px-4 py-3 text-xs text-slate-500">{formatDate(lot.dateReceived)}</td><td className="px-4 py-3 text-xs text-slate-500">{formatDate(lot.expiryDate)}</td><td className="px-4 py-3 text-xs text-slate-700">{lot.currentQuantity} {lot.unit}</td><td className="px-4 py-3"><ReagentStatus status={lotEffectiveStatus(lot)} /></td></tr>)}</tbody></table></div> : <p className="px-4 py-8 text-center text-sm text-slate-500">No lots have been received for this reagent.</p>}</section>
    </main>
  );
}
