export const mediLabWorkbookName = "MediLab_LIS_Catalogue_with_Units_and_Reference_Values.xlsx";
export const malariaSourceCodesConsolidatedIntoPanel = ["PAR-001", "PAR-002"] as const;

export function normalizeCatalogueName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isGenericCatalogueValue(value: string | undefined): boolean {
  return !value || /configure|method-specific|component-specific|as appropriate|device-specific|per .*sop|validated (?:analyser|analyzer|assay|method|device)|per current|per transfusion/i.test(value.trim());
}

export function categoryField(category: string): string {
  return `category:${category}`;
}

export function panelField(panel: string): string {
  return `existing-panel:${panel}`;
}

