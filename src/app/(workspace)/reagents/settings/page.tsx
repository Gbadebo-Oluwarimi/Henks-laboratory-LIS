import { Building2, MapPin, Plus } from "lucide-react";
import { getDatabase } from "@/lib/mongodb";
import { hasPermission, requirePermission } from "@/lib/session";
import type { DepartmentRecord, ReagentStorageLocationRecord } from "@/lib/models";
import { createDepartment, createStorageLocation, toggleDepartmentActive, toggleStorageLocationActive } from "@/app/(workspace)/reagents/actions";
import { ReagentHeader, ReagentTabs, reagentButtonClass, reagentErrorMessage, reagentInputClass, reagentLabelClass } from "@/app/(workspace)/reagents/components";
import { ToastNotification } from "@/app/(workspace)/toast-notification";

const locationTypes = ["LABORATORY", "DEPARTMENT", "STORE", "ROOM", "REFRIGERATOR", "FREEZER", "SHELF", "BIN"] as const;

export default async function ReagentSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }> }) {
  const user = await requirePermission("reagents:view");
  const [database, params] = await Promise.all([getDatabase(), searchParams]);
  const [departments, locations] = await Promise.all([
    database.collection<DepartmentRecord>("departments").find().sort({ name: 1 }).toArray(),
    database.collection<ReagentStorageLocationRecord>("reagentStorageLocations").find().sort({ code: 1 }).toArray(),
  ]);
  const canManage = hasPermission(user, "reagents:manage");
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const noticeCode = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const noticeMessages: Record<string, string> = { "department-created": "Department created.", "location-created": "Storage location created.", "department-updated": "Department status updated.", "location-updated": "Storage location status updated." };
  const error = reagentErrorMessage(errorCode);
  const notice = noticeMessages[noticeCode ?? ""];
  const departmentById = new Map(departments.map((department) => [department._id.toHexString(), department.name]));
  const locationById = new Map(locations.map((location) => [location._id.toHexString(), location]));

  return (
    <main className="min-w-0 space-y-5 pb-8 text-slate-800">
      {notice && <ToastNotification message={notice} />}
      {error && <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <ReagentHeader title="Reagent settings" description="Configure laboratory departments and structured storage locations used by reagent products and lots." />
      <ReagentTabs active="Settings" />
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden border border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-[#073F9F]"><Building2 size={17} /></span><div><h2 className="text-sm font-semibold text-[#073F9F]">Laboratory departments</h2><p className="mt-1 text-xs text-slate-500">Reagent departments are configured here, not hard-coded in the application.</p></div></div>
          {canManage && <form action={createDepartment} className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_1.5fr_auto]"><label className={reagentLabelClass}>Department code<input className={reagentInputClass} name="code" required maxLength={24} placeholder="CHEM" /></label><label className={reagentLabelClass}>Department name<input className={reagentInputClass} name="name" required maxLength={100} placeholder="Chemical Pathology" /></label><div className="flex items-end"><button className={reagentButtonClass} type="submit"><Plus size={14} /> Add department</button></div></form>}
          <div className="divide-y divide-slate-100">{departments.map((department) => <div key={department._id.toHexString()} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-medium text-slate-800">{department.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{department.code}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${department.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{department.active ? "ACTIVE" : "INACTIVE"}</span>{canManage && <form action={toggleDepartmentActive}><input type="hidden" name="departmentId" value={department._id.toHexString()} /><button className="text-xs font-semibold text-[#073F9F] underline decoration-slate-300 underline-offset-2">{department.active ? "Deactivate" : "Reactivate"}</button></form>}</div></div>)}{!departments.length && <p className="px-4 py-8 text-center text-sm text-slate-500">No departments configured.</p>}</div>
        </section>

        <section className="overflow-hidden border border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><MapPin size={17} /></span><div><h2 className="text-sm font-semibold text-[#073F9F]">Storage locations</h2><p className="mt-1 text-xs text-slate-500">Build a hierarchy from laboratory and store down to refrigerator, shelf, or bin.</p></div></div>
          {canManage && <form action={createStorageLocation} className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><label className={reagentLabelClass}>Location code<input className={reagentInputClass} name="code" required maxLength={40} placeholder="CHEM-FRIDGE-02" /></label><label className={reagentLabelClass}>Location name<input className={reagentInputClass} name="name" required maxLength={100} placeholder="Refrigerator 02" /></label><label className={reagentLabelClass}>Location type<select className={reagentInputClass} name="type" defaultValue="REFRIGERATOR">{locationTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className={reagentLabelClass}>Parent location<select className={reagentInputClass} name="parentId" defaultValue=""><option value="">Top-level location</option>{locations.filter((location) => location.active).map((location) => <option key={location._id.toHexString()} value={location._id.toHexString()}>{location.code} · {location.name}</option>)}</select></label><label className={reagentLabelClass}>Department (optional)<select className={reagentInputClass} name="departmentId" defaultValue=""><option value="">No department</option>{departments.filter((department) => department.active).map((department) => <option key={department._id.toHexString()} value={department._id.toHexString()}>{department.name}</option>)}</select></label><label className={reagentLabelClass}>Temperature range<input className={reagentInputClass} name="temperatureRange" maxLength={80} placeholder="Use lab/manufacturer guidance" /></label><div className="sm:col-span-2"><button className={reagentButtonClass} type="submit"><Plus size={14} /> Add location</button></div></form>}
          <div className="divide-y divide-slate-100">{locations.map((location) => <div key={location._id.toHexString()} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{location.name} <span className="text-xs font-normal text-slate-400">· {location.type.replaceAll("_", " ")}</span></p><p className="mt-0.5 text-[10px] text-slate-500">{location.code}{location.parentId ? ` · ${locationById.get(location.parentId.toHexString())?.name ?? "Parent inactive"}` : " · Top-level"}{location.departmentId ? ` · ${departmentById.get(location.departmentId.toHexString()) ?? "Department inactive"}` : ""}{location.temperatureRange ? ` · ${location.temperatureRange}` : ""}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${location.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{location.active ? "ACTIVE" : "INACTIVE"}</span>{canManage && <form action={toggleStorageLocationActive}><input type="hidden" name="locationId" value={location._id.toHexString()} /><button className="text-xs font-semibold text-[#073F9F] underline decoration-slate-300 underline-offset-2">{location.active ? "Deactivate" : "Reactivate"}</button></form>}</div></div>)}{!locations.length && <p className="px-4 py-8 text-center text-sm text-slate-500">No storage locations configured.</p>}</div>
        </section>
      </div>
      {!canManage && <p className="text-xs text-slate-500">You have read-only access to reagent settings.</p>}
    </main>
  );
}
