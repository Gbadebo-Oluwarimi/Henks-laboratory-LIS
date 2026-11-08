"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { displayPanelName } from "@/lib/catalogue";

type DepartmentOption = { code: string; name: string };
export type OrderableCataloguePanel = {
  panel: string;
  departmentCode?: string;
  resultFieldCount: number;
  subcategories?: string[];
  specimenTypes: string[];
};

const departmentFor = (panel: OrderableCataloguePanel) => panel.departmentCode || "__unassigned__";
const panelKey = (panel: OrderableCataloguePanel) => JSON.stringify({ departmentCode: departmentFor(panel), panel: panel.panel });

export function TestSelection({
  departments,
  panels,
  prices,
}: {
  departments: DepartmentOption[];
  panels: OrderableCataloguePanel[];
  prices: Record<string, string>;
}) {
  const [activeDepartment, setActiveDepartment] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedPanelKeys, setSelectedPanelKeys] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const hasUnassigned = panels.some((panel) => !panel.departmentCode);
  const departmentOptions = [...departments, ...(hasUnassigned ? [{ code: "__unassigned__", name: "Unassigned legacy tests" }] : [])];
  const selectedPanels = useMemo(() => panels.filter((panel) => selectedPanelKeys.includes(panelKey(panel))), [panels, selectedPanelKeys]);
  const visiblePanels = useMemo(() => panels.filter((panel) => {
    return departmentFor(panel) === activeDepartment && (!search.trim() || `${displayPanelName(panel.panel)} ${panel.specimenTypes.join(" ")}`.toLowerCase().includes(search.trim().toLowerCase()));
  }), [panels, activeDepartment, search]);
  const panelNames = [...new Set(selectedPanels.map((panel) => displayPanelName(panel.panel)))];

  const toggleDepartment = (code: string) => {
    if (selectedDepartments.includes(code)) {
      setSelectedDepartments((current) => current.filter((item) => item !== code));
      setSelectedPanelKeys((current) => current.filter((key) => !panels.some((panel) => panelKey(panel) === key && departmentFor(panel) === code)));
      if (activeDepartment === code) setActiveDepartment("");
      return;
    }
    setSelectedDepartments((current) => [...current, code]);
    setActiveDepartment(code);
    setSearch("");
  };

  const setPanelSelected = (panel: OrderableCataloguePanel, checked: boolean) => {
    const key = panelKey(panel);
    setSelectedPanelKeys((current) => checked ? [...new Set([...current, key])] : current.filter((item) => item !== key));
  };

  const selectVisible = (checked: boolean) => {
    const keys = visiblePanels.map(panelKey);
    setSelectedPanelKeys((current) => checked ? [...new Set([...current, ...keys])] : current.filter((key) => !keys.includes(key)));
  };

  return <fieldset className="min-w-0 space-y-3">
    <legend className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800"><CheckCircle2 size={17} className="text-[#073F9F]" /> Departments and test panels <span className="text-red-500">*</span></legend>
    <p className="text-xs text-slate-500">Choose a department, then select the main test panels needed. All enabled result fields under each selected panel are added to the order for staff to complete later.</p>
    {panels.length === 0 ? <div className="border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">No test panels are currently available for new orders.</div> : <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{departmentOptions.map((department) => {
        const count = panels.filter((panel) => departmentFor(panel) === department.code).length;
        const checked = selectedDepartments.includes(department.code);
        const selectedCount = selectedPanels.filter((panel) => departmentFor(panel) === department.code).length;
        return <div key={department.code} className={`flex items-center gap-3 border px-3 py-2.5 transition-colors ${checked ? "border-[#0049B7] bg-[#EAF9FE]" : "border-slate-200 bg-white hover:border-[#0049B7]"}`}>
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"><input type="checkbox" checked={checked} onChange={() => toggleDepartment(department.code)} className="h-4 w-4 shrink-0 accent-[#0049B7]" /><span className="min-w-0 flex-1 text-sm font-medium text-slate-700">{department.name}<span className="mt-0.5 block text-[10px] font-normal text-slate-500">{count} main {count === 1 ? "test panel" : "test panels"}{selectedCount ? ` · ${selectedCount} selected` : ""}</span></span></label>
          {checked && <button type="button" onClick={() => { setActiveDepartment(department.code); setSearch(""); }} className="text-[10px] font-semibold text-blue-700 hover:underline">View panels</button>}
        </div>;
      })}</div>
      {selectedPanels.map((panel) => <input key={panelKey(panel)} type="hidden" name="selectedPanelKeys" value={panelKey(panel)} />)}
      {activeDepartment && selectedDepartments.includes(activeDepartment) && <section className="overflow-hidden border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center">
          <div><h3 className="text-xs font-semibold text-[#073F9F]">{departmentOptions.find((department) => department.code === activeDepartment)?.name}</h3><p className="mt-0.5 text-[10px] text-slate-500">{visiblePanels.length} matching panels · {selectedPanels.filter((panel) => departmentFor(panel) === activeDepartment).length} selected</p></div>
          <div className="flex items-center gap-2"><label className="flex h-8 min-w-52 items-center gap-2 border border-slate-200 bg-white px-2 text-slate-400"><Search size={13} /><span className="sr-only">Search test panels in this department</span><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-xs text-slate-700 outline-none" placeholder="Search test panels" /></label><button type="button" onClick={() => selectVisible(true)} className="text-[10px] font-semibold text-blue-700 hover:underline">Select all</button><button type="button" onClick={() => selectVisible(false)} className="text-[10px] font-semibold text-slate-500 hover:underline">Clear</button></div>
        </div>
        {activeDepartment === "__unassigned__" && <p className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">These legacy panels have no department assignment yet. They remain available here to avoid interrupting existing ordering while the catalogue is categorized.</p>}
        <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {visiblePanels.map((panel) => <label key={panelKey(panel)} className="flex cursor-pointer items-center gap-3 px-3 py-3 hover:bg-blue-50/50">
            <input type="checkbox" checked={selectedPanelKeys.includes(panelKey(panel))} onChange={(event) => setPanelSelected(panel, event.target.checked)} className="h-4 w-4 shrink-0 accent-[#0049B7]" />
            <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800">{displayPanelName(panel.panel)}</span><span className="mt-0.5 block text-[10px] text-slate-500">{panel.resultFieldCount} result {panel.resultFieldCount === 1 ? "field" : "fields"}{panel.subcategories?.length ? ` · ${panel.subcategories.join(", ")}` : ""}{panel.specimenTypes.length ? ` · ${panel.specimenTypes.join(", ")}` : ""}</span></span>
            {prices[panel.panel] && <span className="shrink-0 text-[10px] font-medium text-slate-600">{prices[panel.panel]}<span className="block text-right text-[9px] text-slate-400">panel price</span></span>}
          </label>)}
          {!visiblePanels.length && <p className="px-4 py-8 text-center text-xs text-slate-500">No panels match this search.</p>}
        </div>
      </section>}
      <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Selected: <strong>{selectedPanels.length} main test {selectedPanels.length === 1 ? "panel" : "panels"}</strong>{selectedPanels.length > 0 && <span> · {selectedPanels.reduce((count, panel) => count + panel.resultFieldCount, 0)} result fields added</span>}</div>
      {panelNames.length > 0 && <p className="text-[10px] text-slate-500">The panel price is captured once for each selected main test. Its result fields appear on the order and report.</p>}
    </>}
  </fieldset>;
}
