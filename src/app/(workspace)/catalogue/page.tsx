import {
  CheckCircle2,
  ClipboardList,
  CircleX,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";
import { RemoveCatalogueTestButton } from "@/app/(workspace)/catalogue/remove-test-button";
import { renameCataloguePanel, updateCataloguePanelDepartment } from "@/app/(workspace)/catalogue/panel-actions";

import {
  createCatalogueTest,
  createCataloguePrice,
  toggleCatalogueTest,
  updateCatalogueTest,
} from "@/app/actions";
import { ToastNotification } from "@/app/(workspace)/toast-notification";
import { getCurrentUser } from "@/lib/session";
import { getDatabase } from "@/lib/mongodb";
import { hasSourceReference, type CatalogueTest, type ResultKind } from "@/lib/catalogue";
import type { CataloguePriceRecord, DepartmentRecord } from "@/lib/models";

type CatalogueRecord = CatalogueTest & {
  enabled: boolean;
  specimenType?: string;
};

const inputClass = "h-9 w-full min-w-0 border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-blue-500";
const sheetInputClass = "h-6 w-full min-w-0 border-0 bg-transparent px-1.5 text-[11px] leading-5 text-slate-800 outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500";

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[]; error?: string | string[] }>;
}) {
  const [database, user, params] = await Promise.all([
    getDatabase(),
    getCurrentUser(),
    searchParams,
  ]);
  const canManage = user?.role === "Administrator";
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  const definitions = await database
    .collection<CatalogueRecord>("testDefinitions")
    .find()
    .sort({ panel: 1, subcategory: 1, name: 1 })
    .toArray();
  const departments = await database.collection<DepartmentRecord>("departments").find({ active: true, departmentKind: { $ne: "ORDER_GROUP" } }).sort({ name: 1 }).toArray();
  const priceHistory = await database.collection<CataloguePriceRecord>("cataloguePrices")
    .find()
    .sort({ effectiveFrom: -1 })
    .toArray();
  const currentPrices = new Map<string, CataloguePriceRecord>();
  for (const price of priceHistory) {
    if (price.effectiveFrom <= new Date() && !currentPrices.has(price.panel)) currentPrices.set(price.panel, price);
  }

  const groups = new Map<string, CatalogueRecord[]>();
  for (const test of definitions) {
    const panel = /^\s*infection screen\s*$/i.test(test.panel)
      ? "Full Blood Count (FBC/CBC)"
      : test.panel;
    const visibleTest = panel === test.panel ? test : { ...test, panel };
    groups.set(panel, [...(groups.get(panel) ?? []), visibleTest]);
  }

  const enabledTests = definitions.filter((test) => test.enabled && !test.panelHeaderOnly).length;
  const subpanels = [...new Set(definitions.flatMap((test) => test.subcategory?.trim() ? [test.subcategory.trim()] : []))].sort((a, b) => a.localeCompare(b));
  const notices: Record<string, string> = {
    created: "Test added to the catalogue and available for new orders.",
    updated: "Catalogue changes saved.",
    "price-created": "A new price was recorded. Existing orders keep their saved price.",
    "panel-department-updated": "Department assignment saved for the entire test panel.",
    "panel-renamed": "Panel name updated in the catalogue and applicable open orders.",
  };
  const errors: Record<string, string> = {
    validation: "Complete the required test fields and try again.",
    "duplicate-test": "A test with that name already exists in this panel.",
    "panel-department-mismatch": "All result fields under a panel must share one department. Save a department for the entire panel, then add the result field.",
    "panel-department-required": "Select a department for the main test panel.",
    missing: "That test definition no longer exists.",
    "price-validation": "Enter a valid price, effective date, and reason.",
    "price-date-conflict": "A price already exists for this panel and effective date. Choose a different effective date.",
    "invalid-department": "Select an active laboratory department.",
    "panel-department-validation": "Choose a panel and an active department, then try again.",
    "panel-missing": "That test panel no longer exists. Refresh and try again.",
    "panel-header-not-result": "Panel profiles describe the main test only. Configure and order the panel’s result fields instead.",
    "panel-rename-validation": "Enter a panel name up to 120 characters and try again.",
    "duplicate-panel-name": "A panel with that name already exists. Choose a unique name.",
    "panel-price-conflict": "This panel has price history that would overlap another panel’s effective dates. Resolve the price history before renaming.",
  };

  return (
    <main className="min-w-0 space-y-6 pb-8 text-slate-800">
      {notice && notices[notice] && <ToastNotification message={notices[notice]} />}
      {error && errors[error] && (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {errors[error]}
        </div>
      )}

      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center border border-[#D5E5F7] bg-[#F0F6FC] text-[#073F9F]">
              <ClipboardList size={15} />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0049B7]">
              LABORATORY / TESTS
            </p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#073F9F]">Test catalogue</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Assign departments to main test panels. Individual rows are result fields shown after a panel is ordered.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><div className="border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600">{groups.size} {groups.size === 1 ? "panel" : "panels"} · {enabledTests} active tests</div></div>
      </header>

      {canManage && (
        <details className="border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-[#073F9F]">
              <Plus size={17} /> Add a test or subtest
            </span>
            <span className="text-xs text-slate-500">Administrator only</span>
          </summary>
          <form action={createCatalogueTest} className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-6">
            <label className="grid gap-1 text-xs font-medium text-slate-600 xl:col-span-2">
              Panel / group
              <input className={inputClass} name="panel" list="catalogue-panels" required maxLength={120} placeholder="e.g. Full Blood Count (FBC/CBC)" />
              <datalist id="catalogue-panels">{[...groups.keys()].map((panel) => <option key={panel} value={panel} />)}</datalist>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600 xl:col-span-2">
              Test name
              <input className={inputClass} name="name" required maxLength={120} placeholder="e.g. Monocytes" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600 xl:col-span-2">
              Subpanel (optional)
              <input className={inputClass} name="subcategory" list="catalogue-subpanels" maxLength={120} placeholder="Create or reuse a subpanel" />
              <datalist id="catalogue-subpanels">{subpanels.map((subpanel) => <option key={subpanel} value={subpanel} />)}</datalist>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Result type
              <select className={inputClass} name="kind" defaultValue="numeric">
                <option value="numeric">Numeric</option>
                <option value="qualitative">Qualitative</option>
                <option value="narrative">Narrative</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Department for this panel
              <select className={inputClass} name="departmentCode" defaultValue="" required><option value="" disabled>Select department</option>{departments.map((department) => <option key={department.code} value={department.code}>{department.name}</option>)}</select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Unit
              <input className={inputClass} name="unit" maxLength={40} placeholder="e.g. x10^9/L" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2 xl:col-span-3">
              Reference range / notes
              <input className={inputClass} name="sourceReference" maxLength={240} placeholder="Enter the reference range used by your lab" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2 xl:col-span-2">
              Default specimen
              <input className={inputClass} name="specimenType" maxLength={120} placeholder="Optional" />
            </label>
            <div className="flex items-end">
              <button className="inline-flex h-9 items-center gap-2 border border-blue-500 bg-blue-500 px-3 text-sm font-medium text-white hover:bg-blue-600" type="submit">
                <Plus size={15} /> Add to catalogue
              </button>
            </div>
          </form>
        </details>
      )}

      <section className="grid grid-cols-1 border border-slate-200 bg-white sm:grid-cols-2">
        <div className="border-b border-slate-200 px-4 py-4 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total definitions</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{definitions.length}</p>
          <p className="mt-2 text-[10px] text-slate-500">Saved test and subtest definitions</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Available for new orders</p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            <CheckCircle2 className="text-emerald-600" size={20} /> {enabledTests}
          </p>
          <p className="mt-2 text-[10px] text-slate-500">Changes apply to new orders; saved reports stay unchanged</p>
        </div>
      </section>

      <div className="space-y-5">
        {[...groups.entries()].map(([panel, tests]) => {
          const sourcePanels = [...new Set(tests.map((test) => definitions.find((definition) => definition.code === test.code)?.panel ?? panel))];
          const assignedDepartmentCodes = [...new Set(tests.map((test) => test.departmentCode ?? ""))];
          const assignedDepartmentCode = assignedDepartmentCodes.length === 1 ? assignedDepartmentCodes[0] : "";
          const assignedDepartmentName = assignedDepartmentCodes.length > 1
            ? "Mixed — choose a department to apply it to this entire panel"
            : assignedDepartmentCode
              ? departments.find((department) => department.code === assignedDepartmentCode)?.name ?? "Inactive / unavailable"
              : "Unassigned";
          return (
          <section className="overflow-hidden border border-slate-200 bg-white" key={panel}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-[#073F9F]"><ClipboardList size={15} /></span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{panel}</h2>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {tests.filter((test) => !test.panelHeaderOnly).length} result fields · {tests.filter((test) => !test.panelHeaderOnly && test.enabled).length} active
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-700">
                    Current price: {currentPrices.has(panel) ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(currentPrices.get(panel)!.amountMinor / 100) : <span className="text-amber-700">Not configured</span>}
                  </p>
                </div>
              </div>
              {canManage ? <div className="flex flex-wrap items-end justify-end gap-3">
                <form action={renameCataloguePanel} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="panel" value={panel} />
                  {sourcePanels.map((sourcePanel) => <input key={sourcePanel} type="hidden" name="sourcePanels" value={sourcePanel} />)}
                  <label className="grid gap-1 text-[10px] font-medium text-slate-600">Panel name<input className="h-8 w-56 border border-slate-200 bg-white px-2 text-xs" name="newPanel" defaultValue={panel} maxLength={120} required /></label>
                  <button type="submit" className="inline-flex h-8 items-center gap-1.5 border border-slate-300 bg-white px-2.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"><Save size={12} /> Rename panel</button>
                </form>
                <form action={updateCataloguePanelDepartment} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="panel" value={panel} />
                  {sourcePanels.map((sourcePanel) => <input key={`department-${sourcePanel}`} type="hidden" name="sourcePanels" value={sourcePanel} />)}
                  <label className="grid gap-1 text-[10px] font-medium text-slate-600">Department for this panel<select className="h-8 min-w-48 border border-slate-200 bg-white px-2 text-xs" name="departmentCode" defaultValue={assignedDepartmentCode}><option value="">Unassigned</option>{departments.map((department) => <option key={department.code} value={department.code}>{department.name}</option>)}</select></label>
                  <button type="submit" className="inline-flex h-8 items-center gap-1.5 border border-blue-600 bg-blue-600 px-2.5 text-[10px] font-semibold text-white hover:bg-blue-700"><Save size={12} /> Save department</button>
                </form>
              </div> : <span className="text-[10px] font-medium text-slate-500">Department: {assignedDepartmentName}</span>}
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1000px] border-separate border-spacing-0 border-l border-t border-slate-300 text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-white">
                    <th className="sticky left-0 z-10 w-10 border-b border-r border-slate-300 bg-slate-100 px-2 py-3 text-center text-[10px] font-semibold uppercase text-slate-500">#</th>
                    <th className="w-[19%] border-b border-r border-slate-300 bg-slate-100 px-3 py-3 text-[10px] font-semibold uppercase text-[#073F9F]">Main test panel</th>
                    <th className="w-[16%] border-b border-r border-slate-300 bg-slate-100 px-3 py-3 text-[10px] font-semibold uppercase text-[#073F9F]">Subpanel / result field</th>
                    <th className="w-[10%] border-b border-r border-slate-300 bg-slate-100 px-3 py-3 text-[10px] font-semibold uppercase text-[#073F9F]">Result type</th>
                    <th className="w-[8%] border-b border-r border-slate-300 bg-slate-100 px-3 py-3 text-[10px] font-semibold uppercase text-[#073F9F]">Unit</th>
                    <th className="w-[17%] border-b border-r border-slate-300 bg-slate-100 px-3 py-3 text-[10px] font-semibold uppercase text-[#073F9F]">Reference</th>
                    <th className="w-[11%] border-b border-r border-slate-300 bg-slate-100 px-3 py-3 text-[10px] font-semibold uppercase text-[#073F9F]">Specimen</th>
                    <th className="w-[19%] border-b border-slate-300 bg-slate-100 px-3 py-3 text-[10px] font-semibold uppercase text-[#073F9F]">Availability / actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((test, rowIndex) => {
                    const formId = `edit-${test.code.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                    return (
                      <tr key={test.code} className="align-middle hover:bg-blue-50/40">
                        <td className="sticky left-0 border-b border-r border-slate-200 bg-slate-50 px-1 py-0.5 text-center font-mono text-[9px] leading-5 text-slate-400">{rowIndex + 1}</td>
                        <td className="border-b border-r border-slate-200 p-0.5">
                          {canManage && <form id={formId} action={updateCatalogueTest}><input type="hidden" name="code" value={test.code} /><input type="hidden" name="panel" value={test.panel} /></form>}
                          <span className="block truncate px-2 text-[11px] leading-6 text-slate-600" title={test.panel}>{test.panel}</span>
                        </td>
                        <td className="border-b border-r border-slate-200 p-0.5">
                          {test.panelHeaderOnly ? <><span className="font-semibold">{test.name}</span><span className="mt-1 block text-[9px] font-medium text-blue-700">Panel profile · not entered as a result</span></> : canManage ? <><input className={`${sheetInputClass} text-blue-700`} form={formId} name="subcategory" defaultValue={test.subcategory ?? ""} list="catalogue-subpanels" maxLength={120} aria-label={`${test.name} subpanel`} placeholder="Subpanel (optional)" /><input className={sheetInputClass} form={formId} name="name" defaultValue={test.name} required maxLength={120} aria-label={`${test.name} name`} title={test.code} /></> : <>{test.subcategory && <span className="block px-2 pt-1 text-[9px] font-semibold uppercase tracking-wide text-blue-700">{test.subcategory}</span>}<span className="font-semibold">{test.name}</span><span className="mt-1 block font-mono text-[9px] text-slate-400">{test.code}</span></>}
                        </td>
                        <td className="border-b border-r border-slate-200 p-0.5">
                          {canManage ? (
                            <select className={sheetInputClass} form={formId} name="kind" defaultValue={test.kind} aria-label={`${test.name} result type`}>
                              {(["numeric", "qualitative", "narrative"] as ResultKind[]).map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                            </select>
                          ) : test.kind}
                        </td>
                        <td className="border-b border-r border-slate-200 p-0.5">{canManage ? <input className={sheetInputClass} form={formId} name="unit" defaultValue={test.unit} maxLength={40} aria-label={`${test.name} unit`} /> : test.unit || "—"}</td>
                        <td className="border-b border-r border-slate-200 p-0.5">{canManage ? <input className={sheetInputClass} form={formId} name="sourceReference" defaultValue={test.sourceReference} maxLength={240} aria-label={`${test.name} reference`} /> : hasSourceReference(test.sourceReference) ? test.sourceReference.trim() : "-"}</td>
                        <td className="border-b border-r border-slate-200 p-0.5">{canManage ? <input className={sheetInputClass} form={formId} name="specimenType" defaultValue={test.specimenType ?? ""} maxLength={120} aria-label={`${test.name} specimen`} /> : test.specimenType || "—"}</td>
                        <td className="border-b border-slate-200 px-1.5 py-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={test.enabled ? "inline-flex h-6 w-7 shrink-0 items-center justify-center border border-emerald-200 bg-emerald-50 text-emerald-700" : "inline-flex h-6 w-7 shrink-0 items-center justify-center border border-slate-200 bg-slate-100 text-slate-500"}
                              role="img"
                              aria-label={test.enabled ? "Active" : "Removed"}
                              title={test.enabled ? "Active" : "Removed"}
                            >
                              {test.enabled ? <CheckCircle2 size={13} /> : <CircleX size={13} />}
                            </span>
                            {canManage && (
                              <>
                                <button className="inline-flex h-6 w-7 shrink-0 items-center justify-center border border-blue-500 bg-blue-500 text-white hover:bg-blue-600" type="submit" form={formId} title="Save test changes" aria-label={`Save ${test.name} changes`}><Save size={13} /></button>
                                {!test.panelHeaderOnly && (test.enabled ? <RemoveCatalogueTestButton code={test.code} name={test.name} /> : (
                                  <form action={toggleCatalogueTest}>
                                    <input type="hidden" name="code" value={test.code} />
                                    <button className="inline-flex h-6 w-7 shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" type="submit" title="Restore to future orders" aria-label={`Restore ${test.name} to future orders`}>
                                      <RotateCcw size={13} />
                                    </button>
                                  </form>
                                ))}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canManage && <div className="border-t border-slate-200 bg-white p-4">
              <form action={createCataloguePrice} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
                <input type="hidden" name="panel" value={panel} />
                <label className="grid gap-1 text-xs font-medium text-slate-600">New price (NGN)<input className={inputClass} name="amount" type="number" min="0" step="0.01" required placeholder="0.00" /></label>
                <label className="grid gap-1 text-xs font-medium text-slate-600">Effective from<input className={inputClass} name="effectiveFrom" type="date" required /></label>
                <label className="grid gap-1 text-xs font-medium text-slate-600 lg:col-span-1">Reason<input className={inputClass} name="reason" required minLength={3} maxLength={300} placeholder="Approved price change" /></label>
                <button className="inline-flex h-9 items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" type="submit"><Save size={13} />Record price</button>
              </form>
              {(priceHistory.filter((price) => price.panel === panel).length > 0) && <details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer">View price history</summary><ul className="mt-2 space-y-1">{priceHistory.filter((price) => price.panel === panel).map((price) => <li key={price._id.toHexString()}>{new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(price.amountMinor / 100)} · effective {price.effectiveFrom.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })} · {price.reason}</li>)}</ul></details>}
            </div>}
          </section>
          );
        })}
      </div>
    </main>
  );
}
