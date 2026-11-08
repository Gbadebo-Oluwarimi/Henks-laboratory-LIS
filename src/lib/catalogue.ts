export type ResultKind = "numeric" | "qualitative" | "narrative";

export type CatalogueTest = {
  code: string;
  panel: string;
  name: string;
  kind: ResultKind;
  unit: string;
  sourceReference: string;
  specimenType?: string;
  /** Panel-level department, repeated on result-field rows for legacy order snapshots. */
  departmentCode?: string;
  /** Source Profile rows describe the main panel and must not become result-entry fields. */
  panelHeaderOnly?: boolean;
  referenceApproved: boolean;
  subcategory?: string;
  sourceWorkbook?: string;
  sourceTestCode?: string;
  sourceCategory?: string;
  sourceSubcategory?: string;
  sourceContainer?: string;
  sourceMethod?: string;
  sourceProcessingLocation?: string;
  sourceConfigurationNotes?: string;
  sourceResultType?: "Numeric" | "Qualitative" | "Descriptive" | "Profile";
  sourceMatchStatus?: "NEW" | "EXISTING_MATCH" | "PANEL_COMPONENT_OVERLAP" | "POSSIBLE_MATCH" | "REVIEW_REQUIRED";
  clinicalReviewStatus?: "PENDING" | "APPROVED";
  requiresClinicalReview?: boolean;
  sourcePanelParametersRequired?: boolean;
  sourceDepartment?: string;
  sourceWorkflow?: "POCT";
  sourceAvailability?: "IN_HOUSE" | "REFERRAL" | "UNAVAILABLE";
};

type PanelSeed = {
  code: string;
  name: string;
  tests: Array<[string, ResultKind?, string?, string?, string?, string?]>;
};

const panels: PanelSeed[] = [
  {
    code: "fbc",
    name: "Full Blood Count (FBC/CBC)",
    tests: [
      ["WBC", "numeric", "x10^9/L", "Normal (4.0 - 10.0)"],
      ["Lymphs", "numeric", "%", "Normal (20 - 40)"],
      ["Mixed", "numeric", "%", "Normal (0 - 10)"],
      ["Neut", "numeric", "%", "Normal (40 - 70)"],
      ["RBC", "numeric", "x10^12/L", "Normal (3.5 - 5.5)"],
      ["Haemoglobin", "numeric", "g/dl", "Normal (11.0 - 16.0)"],
      ["Haematocrit", "numeric", "%", "Normal (35.0 - 46.0)"],
      ["MCV", "numeric", "fl", "Normal (80 - 99.0)"],
      ["MCH", "numeric", "pg", "Normal (26.0 - 32.0)"],
      ["MCHC", "numeric", "g/dl", "Normal (32.0 - 36.0)"],
      ["Lymphs (Absolute)", "numeric", "x10^9/L", "Normal (0.8-4.0)"],
      ["MID (Absolute)", "numeric", "10^9/L", "Normal (0.1-1.5)"],
      ["GRAN (Absolute)", "numeric", "%", "Normal (2.0-7.0)"],
      ["RDW-CV", "numeric", "fL", "Normal (11.0 - 16.0)"],
      ["RDW-SD", "numeric", "fL", "Normal (35.0 - 56.0)"],
      ["PWD", "numeric", "FI", "Normal (15.0 - 17.0)"],
      ["PCT", "numeric", "MI/I", "Normal (1.08 - 2.82)"],
      ["P-LCR", "numeric", "%", "Normal (11.0 - 45.0)"],
    ],
  },
  { code: "crp", name: "C-Reactive Protein (CRP)", tests: [["C-Reactive protein (CRP)", "numeric", "mg/L", "(0 - 10)", "fbc:c-reactive-protein-crp"]] },
  {
    code: "malaria-parasite",
    name: "Malaria Parasite",
    tests: [
      ["RDT result", "qualitative", "", "", "fbc:mp-malaria-parasite-rdt", "RDT"],
      ["Parasite detection", "qualitative", "", "", "fbc:mp-malaria-parasite-microscopy", "Microscopy/Bloodsmear(Malaria Parasite)"],
      ["Species", "narrative", "", "", "malaria-parasite:species", "Microscopy/Bloodsmear(Malaria Parasite)"],
      ["Parasite density", "narrative", "parasites/µL", "", "malaria-parasite:parasite-density", "Microscopy/Bloodsmear(Malaria Parasite)"],
    ],
  },
  {
    code: "malaria-microscopy-bloodsmear",
    name: "Microscopy/Bloodsmear(Malaria Parasite)",
    tests: [
      ["RBC", "numeric", "x10^12/L", "", "malaria-parasite:rbc"],
      ["WBC", "numeric", "x10^9/L", "", "malaria-parasite:wbc"],
      ["PLT", "numeric", "x10^9/L", "", "malaria-parasite:plt"],
    ],
  },
  { code: "hbsag", name: "HBsAg", tests: [["HBsAg", "qualitative", "", "", "fbc:hbsag"]] },
  { code: "hiv-screen", name: "HIV", tests: [["HIV", "qualitative", "", "", "fbc:hiv"]] },
  { code: "hcv-screen", name: "HCV", tests: [["HCV", "qualitative", "", "", "fbc:hcv"]] },
  {
    code: "platelet-count",
    name: "Platelet Count",
    tests: [["Platelet Count", "numeric", "x10^9/L", "Normal (150.0 - 450.0)"]],
  },
  {
    code: "widal",
    name: "Widal",
    tests: [
      ["S. typhi O", "narrative"],
      ["S. typhi H", "narrative"],
      ["S. paratyphi A O (AO)", "narrative"],
      ["S. paratyphi A H (AH)", "narrative", "", "", "widal:s-paratyphi-a-ah"],
      ["S. paratyphi B O (BO)", "narrative"],
      ["S. paratyphi B H (BH)", "narrative", "", "", "widal:s-paratyphi-b-bh"],
      ["S. paratyphi C O (CO)", "narrative"],
      ["S. paratyphi C H (CH)", "narrative"],
    ],
  },
  {
    code: "h-pylori-serology",
    name: "H. pylori Serology",
    tests: [["Helicobacter pylori IgG antibody", "qualitative"]],
  },
  {
    code: "esr",
    name: "ESR",
    tests: [["ESR", "numeric", "mm/Hr", "Male (0 - 10); Female (0 - 15)"]],
  },
  {
    code: "uric-acid",
    name: "Uric Acid (UA)",
    tests: [["Uric Acid (UA)", "numeric", "ummol/L", "Male (201 - 416); Female (143 - 339)"]],
  },
  {
    code: "calcium",
    name: "Calcium (Ca+)",
    tests: [["Calcium (Ca+)", "numeric", "ummol/L", "Norm (2.12 - 2.62)"]],
  },
  {
    code: "eucr",
    name: "EUCR",
    tests: [
      ["Sodium (Na)", "numeric", "mmol/L", "Norm (135 - 155)"],
      ["Potassium (K)", "numeric", "mmol/L", "Norm (3.4 - 5.3)"],
      ["Chloride (Cl)", "numeric", "mmol/L", "Norm (98 - 108)"],
      ["Urea (U)", "numeric", "mmol/L", "Norm (2.1 - 7.1)"],
      ["Creatinine", "numeric", "mmol/L", "Norm (49 - 115)"],
      ["Bicarbonate", "numeric", "mmol/L", "Norm (23 - 31)"],
      ["Creatinine Clearance", "numeric", "ml/min", "", "eucr:creatinine-clearance"],
    ],
  },
  {
    code: "flp",
    name: "FLP",
    tests: [
      ["Cholesterol", "numeric", "mmol/L", "Norm (1 - 5.2)"],
      ["Triglyceride", "numeric", "mmol/L", "Norm (1.7 - 2.3)"],
      ["HDL", "numeric", "mmol/L", "Norm (1.0 - 1.6)"],
      ["LDL", "numeric", "mmol/L", "Norm (3.4 - 4.1)"],
      ["VLDL", "numeric", "mmol/L", "Norm (0.0 - 0.9)"],
    ],
  },
  {
    code: "lft",
    name: "LFT",
    tests: [
      ["Total Bilirubin", "numeric", "mmol/L", "Norm (0 - 17.0)"],
      ["Direct Bilirubin", "numeric", "mmol/L", "Norm (0 - 3.4)"],
      ["Alkaline Phosphatase (ALP)", "numeric", "Iu/L", "Norm (98 - 278)"],
      ["AST", "numeric", "U/L", "Norm (0 - 40)"],
      ["ALT", "numeric", "U/L", "Norm (0 - 40)"],
      ["ALB (Albumin)", "numeric", "g/L", "Norm (35 - 55)"],
      ["Total protein", "numeric", "g/L", "Norm (62 - 85)"],
      ["GGT", "numeric", "g/L", "Norm ( )"],
    ],
  },
  {
    code: "fasting-blood-sugar",
    name: "Fasting blood sugar",
    tests: [
      ["Fasting blood sugar", "numeric", "mmol/L", "Normal (4.2 - 6.4)"],
      ["2 H PP", "numeric", "mmol/L", "", "fasting-blood-sugar:2h-pp"],
      ["Random Blood Sugar", "numeric", "mmol/L", "", "fasting-blood-sugar:random"],
      ["Glycosylated Hemoglobin", "numeric", "%", "", "fasting-blood-sugar:glycosylated-hemoglobin"],
    ],
  },
  {
    code: "hormonal-assay",
    name: "Hormonal Assay",
    tests: [
      ["TSH", "numeric", "mlu/ml"], ["T3", "numeric", "ng/ml"], ["T4", "numeric", "ug/dl"],
      ["LH", "numeric", "mlu/ml"], ["FSH", "numeric", "m/u/ml"], ["Testosterone", "numeric", "ng/ml"],
      ["Prolactin", "numeric", "ng/ml"], ["Estrogen", "numeric", "pg/ml"], ["Progesterone", "numeric", "ng/ml"], ["PSA", "numeric", "ng/ml"],
    ],
  },
  {
    code: "tumour-markers",
    name: "Tumor Markers",
    tests: [
      ["Alpha feto protein", "qualitative"], ["CEA", "qualitative"], ["CA 15-3", "qualitative"], ["CA 125", "qualitative"],
      ["Hepatitis B Core antigen", "qualitative"], ["Hepatitis B Envelope antigen", "qualitative"], ["Other tumor marker", "narrative"],
    ],
  },
  {
    code: "glucose-tolerance",
    name: "Glucose Tolerance Test",
    tests: [["Time / Blood / Urine readings", "narrative", "", "", "glucose-tolerance:readings"]],
  },
  {
    code: "serology-report-form",
    name: "Serology",
    tests: [
      ["Pregnancy Test", "qualitative"], ["HBs Ag", "qualitative"], ["HBc Ag", "qualitative"],
      ["HBe Ag", "qualitative"], ["HCV", "qualitative"], ["Other serology", "narrative"],
    ],
  },
  {
    code: "urinalysis",
    name: "Urinalysis",
    tests: [
      ["Appearance", "narrative"], ["Glucose", "qualitative"], ["Protein", "qualitative"], ["Ketones", "qualitative"],
      ["Nitrites", "qualitative"], ["Bilirubin", "qualitative"], ["Urobilinogen", "qualitative"], ["Blood", "qualitative"],
      ["Ascorbic acid", "qualitative"], ["Leucocytes", "qualitative"], ["pH", "numeric"], ["Specific gravity", "numeric"],
    ],
  },
  {
    code: "csf-analysis",
    name: "CSF Analysis",
    tests: [["CSF Protein", "numeric", "g/L"], ["CSF Glucose", "numeric", "mmol/L"]],
  },
  {
    code: "coagulation",
    name: "Coagulation Tests",
    tests: [["Clotting Time", "numeric", "minutes"], ["Bleeding Time", "numeric", "minutes"], ["P.T", "numeric", "seconds"], ["P.T.T.K", "numeric", "seconds"], ["Fibrinogen", "numeric", "g/L"]],
  },
  {
    code: "blood-group-genotype",
    name: "Haemoglobin Genotype / Blood Group",
    tests: [["Hb Genotype", "qualitative"], ["Blood Group", "qualitative"]],
  },
  {
    code: "other-investigations",
    name: "Other Investigations",
    tests: [
      ["Stool MCS", "narrative"], ["Semen MCS", "narrative"], ["Semen Analysis", "narrative"], ["CSF MCS", "narrative"],
      ["HVS/ECS MCS", "narrative"], ["Urethral Swab MCS", "narrative"], ["Aspirate/Pus/Wound MCS", "narrative"],
      ["Ear Swab MCS", "narrative"], ["Throat Swab MCS", "narrative"], ["Occult Blood Test", "qualitative"],
      ["Serum AFB", "qualitative"], ["Blood Culture", "narrative"], ["AFB Microscopy", "narrative"],
      ["Mantoux Test", "qualitative"], ["Skin Scraping", "narrative"], ["Skin Snip", "narrative"],
      ["Stool Microscopy", "narrative"], ["Urine Microscopy", "narrative"], ["Mycology", "narrative"],
      ["Rheumatoid Factor", "qualitative"], ["Chlamydia", "qualitative"], ["Other investigation", "narrative"],
    ],
  },
  {
    code: "hvs",
    name: "HVS (High Vaginal Swab)",
    tests: [
      ["Pus cell", "numeric", "/HpF"],
      ["Epithelial cells", "numeric", "/HpF"],
      ["Yeast cells", "numeric", "/HpF"],
      ["Bacterial cells", "qualitative"],
      ["Schistosoma Haematobium", "qualitative"],
      ["RBC", "numeric", "/HpF"],
      ["Trichomonas Vaginalis", "qualitative"],
      ["Culture Report", "narrative"],
    ],
  },
  {
    code: "eye-swab-mcs",
    name: "Eye Swab MCS",
    tests: [["Eye Swab MCS", "narrative"], ["Culture Report", "narrative"]],
  },
  {
    code: "urine-mcs",
    name: "Urine MCS",
    tests: [
      ["Appearance", "narrative"],
      ["Pus cell", "numeric", "/HpF"],
      ["Epithelial cells", "numeric", "/HpF"],
      ["RBC", "numeric", "/HpF"],
      ["Yeast cell", "numeric", "/HpF"],
      ["Bacterial cells", "numeric", "/HpF"],
      ["Crystal oxalate", "numeric", "/HpF"],
      ["Calcium oxalate", "numeric", "/HpF"],
      ["Cast", "numeric", "/HpF"],
      ["Schistosoma Haematobium", "numeric", "/HpF"],
      ["Trichomonas Vaginalis", "numeric", "/HpF"],
      ["Culture report", "narrative"],
    ],
  },
  {
    code: "sputum-mcs",
    name: "Sputum MCS",
    tests: [["Appearance", "narrative"], ["Microscophy", "narrative"], ["Culture report", "narrative"]],
  },
  {
    code: "thyroid-function",
    name: "Thyroid Function Test (TSH, FT3, FT4)",
    tests: [
      ["Thyroid Stimulating Hormol", "numeric", "Ulu/ml", "Male (0.39 - 6.16)"],
      ["T4", "numeric", "Ug/ml", "Male (4.8 - 11.6)"],
      ["T3", "numeric", "Ng/ml", "Male (0.52 - 1.85)"],
    ],
  },
  { code: "vdrl", name: "VDRL (Syphilis)", tests: [["VDRL (Syphilis)", "qualitative"]] },
  {
    code: "hsv1",
    name: "HSV1 (Herpes Simplex Virus)",
    tests: [["IgG", "qualitative"], ["IgM", "qualitative"]],
  },
  {
    code: "hsv2",
    name: "HSV2 (Herpes Simplex Virus)",
    tests: [["IgG", "qualitative"], ["IgM", "qualitative"]],
  },
  {
    code: "general-mcs",
    name: "MCS Report",
    tests: [
      ["Sample type", "narrative"],
      ["Macroscopy", "narrative"],
      ["Microscopy", "narrative"],
      ["Culture", "narrative"],
      ["Sensitivity", "narrative"],
    ],
  },
];

const departmentByPanelCode: Record<string, string> = {
  fbc: "HEM", esr: "HEM", crp: "CHEM", "malaria-parasite": "PAR", "malaria-microscopy-bloodsmear": "PAR",
  hbsag: "SER", "hiv-screen": "SER", "hcv-screen": "SER", widal: "SER", "h-pylori-serology": "SER", "platelet-count": "HEM", "uric-acid": "CHEM", calcium: "CHEM", eucr: "CHEM", flp: "CHEM", lft: "CHEM", "fasting-blood-sugar": "CHEM",
  hvs: "MIC", "eye-swab-mcs": "MIC", "urine-mcs": "MIC", "sputum-mcs": "MIC", "general-mcs": "MIC",
  "thyroid-function": "ENDO", vdrl: "SER", hsv1: "SER", hsv2: "SER",
  "hormonal-assay": "ENDO", "tumour-markers": "SER", "glucose-tolerance": "CHEM", "serology-report-form": "SER", urinalysis: "CHEM", "csf-analysis": "CHEM", coagulation: "HEM", "blood-group-genotype": "HEM", "other-investigations": "MIC",
};

export const cataloguePanels = panels.map((panel) => ({
  code: panel.code,
  name: panel.name,
  tests: panel.tests.map(([name, kind = "narrative", unit = "", sourceReference = "", code, subcategory]) => ({
    code: code ?? `${panel.code}:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
    panel: panel.name,
    name,
    kind,
    unit,
    sourceReference,
    departmentCode: departmentByPanelCode[panel.code],
    ...(subcategory ? { subcategory } : {}),
    referenceApproved: false as const,
  })),
}));

export const catalogueTests = cataloguePanels.flatMap((panel) => panel.tests);

export function displayPanelName(panel: string): string {
  const displayNames: Record<string, string> = {
    EUCR: "Electrolytes, Urea and Creatinine",
    FLP: "Lipid Profile",
    LFT: "Liver Function Tests",
    "Fasting blood sugar": "Biochemistry",
  };
  return displayNames[panel] ?? panel;
}

export function hasSourceReference(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0
    && !/\(\s*\)/.test(normalized)
    && !/to be configured and validated (?:in the lab|by laboratory)/i.test(normalized);
}
