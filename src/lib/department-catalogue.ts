export type DepartmentKind = "PERFORMING" | "ORDER_GROUP";

export const catalogueDepartmentDefaults: Array<{
  code: string;
  name: string;
  kind: DepartmentKind;
  aliases: string[];
}> = [
  { code: "HEM", name: "Haematology & Coagulation", kind: "PERFORMING", aliases: ["Haematology", "Hematology", "Hematology & Coagulation"] },
  { code: "CHEM", name: "Clinical Chemistry", kind: "PERFORMING", aliases: ["Clinical Chemistry", "Chemistry", "Toxicology & Drug Monitoring", "Tumour Markers"] },
  { code: "MIC", name: "Medical Microbiology", kind: "PERFORMING", aliases: ["Medical Microbiology", "Microbiology"] },
  { code: "PAR", name: "Parasitology", kind: "PERFORMING", aliases: ["Parasitology"] },
  { code: "SER", name: "Immunology & Serology", kind: "PERFORMING", aliases: ["Immunology & Serology", "Immunology and Serology", "Serology"] },
  { code: "ENDO", name: "Endocrinology & Hormones", kind: "PERFORMING", aliases: ["Endocrinology", "Endocrinology & Hormones"] },
  { code: "URI", name: "Urinalysis & Clinical Microscopy", kind: "PERFORMING", aliases: ["Urinalysis & Clinical Microscopy", "Urinalysis"] },
  { code: "BB", name: "Blood Bank & Transfusion", kind: "PERFORMING", aliases: ["Blood Bank & Transfusion", "Blood Bank"] },
  { code: "MOL", name: "Molecular Diagnostics", kind: "PERFORMING", aliases: ["Molecular Diagnostics"] },
  { code: "AND", name: "Andrology & Fertility", kind: "PERFORMING", aliases: ["Andrology & Fertility"] },
  { code: "PATH", name: "Anatomic Pathology (Histopathology & Cytology)", kind: "PERFORMING", aliases: ["Histopathology & Cytology", "Anatomic Pathology"] },
  { code: "ANC-GROUP", name: "Antenatal & Prenatal Profiles", kind: "ORDER_GROUP", aliases: ["Antenatal & Prenatal"] },
];

export function normalizeDepartmentName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const categoryCodes: Record<string, string> = {
  "Haematology": "HEM",
  "Clinical Chemistry": "CHEM",
  "Medical Microbiology": "MIC",
  "Parasitology": "PAR",
  "Immunology & Serology": "SER",
  "Endocrinology": "ENDO",
  "Urinalysis & Clinical Microscopy": "URI",
  "Blood Bank & Transfusion": "BB",
  "Molecular Diagnostics": "MOL",
  "Andrology & Fertility": "AND",
  "Histopathology & Cytology": "PATH",
  "Toxicology & Drug Monitoring": "CHEM",
  "Tumour Markers": "CHEM",
  "Antenatal & Prenatal": "ANC-GROUP",
  "Point-of-Care Testing": "CHEM",
};

const rowCodeOverrides: Record<string, string> = {
  "ANC-002": "ENDO",
  "ANC-003": "CHEM",
  "ANC-004": "BB",
  "ANC-005": "HEM",
  "POC-001": "CHEM",
  "POC-002": "HEM",
  "POC-003": "CHEM",
  "POC-004": "URI",
  "POC-005": "PAR",
  "POC-006": "CHEM",
  "POC-007": "CHEM",
};

export function hasRowSpecificDepartmentMapping(sourceCode: string): boolean {
  return Object.hasOwn(rowCodeOverrides, sourceCode);
}

export function recommendedDepartmentCode(row: { sourceCode: string; category: string }): string {
  return rowCodeOverrides[row.sourceCode] ?? categoryCodes[row.category] ?? "HEM";
}

export const legacyPanelReclassifications: Array<{
  names: string[];
  targetPanel: string;
  departmentCode: string;
}> = [
  { names: ["C-Reactive protein (CRP)", "C-reactive Protein (CRP)"], targetPanel: "C-Reactive Protein (CRP)", departmentCode: "CHEM" },
  { names: ["MP (Malaria Parasite) - Microscopy"], targetPanel: "Malaria Parasite", departmentCode: "PAR" },
  { names: ["MP (Malaria Parasite) - RDT"], targetPanel: "Malaria Parasite", departmentCode: "PAR" },
  { names: ["HBsAg"], targetPanel: "HBsAg", departmentCode: "SER" },
  { names: ["HIV"], targetPanel: "HIV", departmentCode: "SER" },
  { names: ["HCV"], targetPanel: "HCV", departmentCode: "SER" },
];
