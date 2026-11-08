import "server-only";

import { MongoClient, type Db } from "mongodb";
import { cataloguePanels, catalogueTests } from "@/lib/catalogue";
import { catalogueDepartmentDefaults, normalizeDepartmentName } from "@/lib/department-catalogue";
import { malariaSourceCodesConsolidatedIntoPanel, mediLabWorkbookName } from "@/lib/catalogue-import";
import { mediLabCatalogueSource } from "@/lib/medilab-catalogue-source";

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
  var lisDatabasePromise: Promise<Db> | undefined;
}

async function repairDefaultPanelDepartments(database: Db): Promise<void> {
  const definitions = database.collection("testDefinitions");
  // Imported tests used to stay hidden behind a review status. The department
  // catalogue is now the source of truth for which tests may be ordered.
  const legacyReviewCleanup = await definitions.updateMany(
    { requiresClinicalReview: true },
    { $set: { enabled: true, updatedAt: new Date() }, $unset: { requiresClinicalReview: "", clinicalReviewStatus: "" } },
  );
  const departments = await database.collection("departments").find({ active: true, departmentKind: { $ne: "ORDER_GROUP" } }).toArray();
  const departmentCodeByDefault = new Map<string, string>();
  for (const standard of catalogueDepartmentDefaults) {
    const names = new Set([standard.name, ...standard.aliases].map(normalizeDepartmentName));
    const match = departments.find((department) => names.has(normalizeDepartmentName(String(department.name ?? ""))))
      ?? departments.find((department) => String(department.code ?? "").toUpperCase() === standard.code.toUpperCase());
    if (match) departmentCodeByDefault.set(standard.code, String(match.code));
  }

  const updatedAt = new Date();
  const seededPanels = new Map<string, string>();
  for (const test of catalogueTests) {
    if (test.departmentCode && !seededPanels.has(test.panel)) seededPanels.set(test.panel, test.departmentCode);
  }
  const activeCodes = new Set(departments.map((department) => String(department.code)));
  const seededPanelNames = [...seededPanels.keys()];
  const panelDefinitions = await definitions.find({ panel: { $in: seededPanelNames } }, { projection: { panel: 1, departmentCode: 1 } }).toArray();
  const definitionsByPanel = new Map<string, typeof panelDefinitions>();
  for (const definition of panelDefinitions) {
    const rows = definitionsByPanel.get(String(definition.panel)) ?? [];
    rows.push(definition);
    definitionsByPanel.set(String(definition.panel), rows);
  }

  const repairs: Array<{ updateMany: { filter: { panel: string }; update: { $set: { departmentCode: string; updatedAt: Date } } } }> = [];
  for (const [panel, standardCode] of seededPanels) {
    const targetCode = departmentCodeByDefault.get(standardCode);
    const rows = definitionsByPanel.get(panel) ?? [];
    if (!targetCode || !rows.length) continue;
    const codes = new Set(rows.map((definition) => typeof definition.departmentCode === "string" && definition.departmentCode ? definition.departmentCode : "__unassigned__"));
    // Preserve a single, valid catalogue assignment (including an intentional
    // admin override). Repair only legacy conflicts or codes no longer active.
    if (codes.size === 1 && [...codes].every((code) => activeCodes.has(code))) continue;
    repairs.push({ updateMany: { filter: { panel }, update: { $set: { departmentCode: targetCode, updatedAt } } } });
  }

  const result = repairs.length ? await definitions.bulkWrite(repairs) : undefined;
  const changedDefinitionCount = (result?.modifiedCount ?? 0) + legacyReviewCleanup.modifiedCount;

  if (changedDefinitionCount) {
    await database.collection("auditEvents").insertOne({
      actorType: "SYSTEM",
      action: "catalogue.default_panel_departments_repaired",
      recordType: "cataloguePanels",
      panels: repairs.map((repair) => repair.updateMany.filter.panel),
      changedDefinitionCount,
      legacyReviewEntriesEnabled: legacyReviewCleanup.modifiedCount,
      createdAt: updatedAt,
    });
  }
}

async function repairFbcComponentDuplicates(database: Db): Promise<void> {
  const definitions = database.collection("testDefinitions");
  const overlaps = [
    { sourceCode: "HEM-003", componentCode: "fbc:haemoglobin" },
  ];
  let repaired = 0;
  const repairedSourceCodes: string[] = [];

  for (const overlap of overlaps) {
    const component = await definitions.findOne({ code: overlap.componentCode });
    const sourceEntry = await definitions.findOne({ sourceWorkbook: mediLabWorkbookName, sourceTestCode: overlap.sourceCode });
    if (!component || !sourceEntry || !sourceEntry._id || !component._id) continue;
    if (String(sourceEntry._id) === String(component._id)) continue;

    const source = mediLabCatalogueSource.find((row) => row.sourceCode === overlap.sourceCode);
    if (!source) continue;
    const now = new Date();
    await definitions.updateOne({ _id: sourceEntry._id }, {
      $set: { enabled: false, sourceMatchStatus: "PANEL_COMPONENT_OVERLAP", updatedAt: now },
      $unset: { sourceWorkbook: "", sourceTestCode: "" },
    });
    await definitions.updateOne({ _id: component._id }, {
      $set: {
        sourceWorkbook: mediLabWorkbookName,
        sourceTestCode: source.sourceCode,
        sourceCategory: source.category,
        sourceSubcategory: source.subcategory,
        sourceContainer: source.container,
        sourceMethod: source.method,
        sourceProcessingLocation: source.processingLocation,
        sourceConfigurationNotes: source.configurationNotes,
        sourceResultType: source.resultType,
        sourceMatchStatus: "PANEL_COMPONENT_OVERLAP",
        updatedAt: now,
      },
    });
    repaired++;
    repairedSourceCodes.push(overlap.sourceCode);
  }

  const plateletSource = mediLabCatalogueSource.find((row) => row.sourceCode === "HEM-007");
  const standalonePlatelet = await definitions.findOne({ code: "platelet-count:platelet-count" });
  const sourcePlatelet = await definitions.findOne({ sourceWorkbook: mediLabWorkbookName, sourceTestCode: "HEM-007" });
  const legacyFbcPlatelet = await definitions.findOne({ code: "fbc:plt" });
  if (plateletSource && standalonePlatelet) {
    const now = new Date();
    if (sourcePlatelet && String(sourcePlatelet._id) !== String(standalonePlatelet._id)) {
      await definitions.updateOne({ _id: sourcePlatelet._id }, {
        $set: { enabled: false, sourceMatchStatus: "EXISTING_MATCH", updatedAt: now },
        $unset: { sourceWorkbook: "", sourceTestCode: "" },
      });
      await definitions.updateOne({ _id: standalonePlatelet._id }, {
        $set: {
          sourceWorkbook: mediLabWorkbookName,
          sourceTestCode: plateletSource.sourceCode,
          sourceCategory: plateletSource.category,
          sourceSubcategory: plateletSource.subcategory,
          sourceContainer: plateletSource.container,
          sourceMethod: plateletSource.method,
          sourceProcessingLocation: plateletSource.processingLocation,
          sourceConfigurationNotes: plateletSource.configurationNotes,
          sourceResultType: plateletSource.resultType,
          sourceMatchStatus: "EXISTING_MATCH",
          updatedAt: now,
        },
      });
      repaired++;
      repairedSourceCodes.push(plateletSource.sourceCode);
    }
    if (legacyFbcPlatelet?.enabled !== false) {
      await definitions.updateOne({ code: "fbc:plt" }, {
        $set: { enabled: false, updatedAt: now },
        $unset: { sourceWorkbook: "", sourceTestCode: "" },
      });
      repaired++;
      if (!repairedSourceCodes.includes("HEM-007")) repairedSourceCodes.push("HEM-007");
    }
  }

  if (repaired) {
    await database.collection("auditEvents").insertOne({
      actorType: "SYSTEM",
      action: "catalogue.fbc_component_duplicates_repaired",
      recordType: "cataloguePanels",
      sourceCodes: repairedSourceCodes,
      repairedCount: repaired,
      createdAt: new Date(),
    });
  }
}

async function repairMalariaPanelDefinitions(database: Db): Promise<void> {
  const definitions = database.collection("testDefinitions");
  const malariaFields = [
    { code: "fbc:mp-malaria-parasite-rdt", panel: "Malaria Parasite", name: "RDT result", subcategory: "RDT", kind: "qualitative", unit: "" },
    { code: "fbc:mp-malaria-parasite-microscopy", panel: "Malaria Parasite", name: "Parasite detection", subcategory: "Microscopy/Bloodsmear(Malaria Parasite)", kind: "qualitative", unit: "" },
    { code: "malaria-parasite:species", panel: "Malaria Parasite", name: "Species", subcategory: "Microscopy/Bloodsmear(Malaria Parasite)", kind: "narrative", unit: "" },
    { code: "malaria-parasite:parasite-density", panel: "Malaria Parasite", name: "Parasite density", subcategory: "Microscopy/Bloodsmear(Malaria Parasite)", kind: "narrative", unit: "parasites/µL" },
    { code: "malaria-parasite:rbc", panel: "Microscopy/Bloodsmear(Malaria Parasite)", name: "RBC", kind: "numeric", unit: "x10^12/L" },
    { code: "malaria-parasite:wbc", panel: "Microscopy/Bloodsmear(Malaria Parasite)", name: "WBC", kind: "numeric", unit: "x10^9/L" },
    { code: "malaria-parasite:plt", panel: "Microscopy/Bloodsmear(Malaria Parasite)", name: "PLT", kind: "numeric", unit: "x10^9/L" },
  ];
  let repaired = 0;
  const now = new Date();

  for (const field of malariaFields) {
    const expectedSubcategory = "subcategory" in field
      ? { subcategory: { $ne: field.subcategory } }
      : { subcategory: { $exists: true } };
    const update = {
      $set: { ...field, departmentCode: "PAR", enabled: true, updatedAt: now },
      ...(!("subcategory" in field) ? { $unset: { subcategory: "" } } : {}),
    };
    const result = await definitions.updateOne(
      { code: field.code, $or: [{ panel: { $ne: field.panel } }, { name: { $ne: field.name } }, expectedSubcategory, { departmentCode: { $ne: "PAR" } }, { enabled: { $ne: true } }] },
      update,
    );
    repaired += result.modifiedCount;
  }

  const obsoleteMalariaCodes = ["malaria-parasite:rdt", "malaria-parasite:microscopy-bloodsmear"];
  const disabled = await definitions.updateMany(
    { $and: [
      { $or: [
        { code: { $in: obsoleteMalariaCodes } },
        { name: { $in: ["MP (Malaria Parasite) - Microscopy", "MP (Malaria Parasite) - RDT"] } },
      ] },
      { $or: [
        { enabled: { $ne: false } },
        { panel: { $ne: "Archived Malaria Parasite (legacy)" } },
        { departmentCode: { $exists: true } },
      ] },
    ] },
    { $set: { enabled: false, panel: "Archived Malaria Parasite (legacy)", updatedAt: now }, $unset: { departmentCode: "" } },
  );
  repaired += disabled.modifiedCount;

  // These catalogue tests were previously stored as FBC components. Keep the
  // stable codes so existing results and reagent links remain attached.
  const standaloneTests = [
    { code: "fbc:c-reactive-protein-crp", panel: "C-Reactive Protein (CRP)", name: "C-Reactive protein (CRP)" },
    { code: "fbc:hbsag", panel: "HBsAg", name: "HBsAg" },
    { code: "fbc:hiv", panel: "HIV", name: "HIV" },
    { code: "fbc:hcv", panel: "HCV", name: "HCV" },
  ];
  for (const test of standaloneTests) {
    const sibling = await definitions.findOne({ panel: test.panel, departmentCode: { $exists: true } }, { projection: { departmentCode: 1 } });
    const seededDepartmentCode = catalogueTests.find((catalogueTest) => catalogueTest.panel === test.panel)?.departmentCode;
    const targetDepartmentCode = sibling?.departmentCode ?? seededDepartmentCode;
    const result = await definitions.updateOne(
      { code: test.code, $or: [{ panel: { $ne: test.panel } }, { name: { $ne: test.name } }, { subcategory: { $exists: true } }, ...(targetDepartmentCode ? [{ departmentCode: { $ne: targetDepartmentCode } }] : [])] },
      { $set: { panel: test.panel, name: test.name, ...(targetDepartmentCode ? { departmentCode: targetDepartmentCode } : {}), updatedAt: now }, $unset: { subcategory: "" } },
    );
    repaired += result.modifiedCount;
  }

  const standaloneHematologyTests = mediLabCatalogueSource
    .filter((test) => ["HEM-004", "HEM-005", "HEM-006", "HEM-008", "HEM-009"].includes(test.sourceCode))
    .map((test) => ({ code: `mlis:${test.sourceCode.toLowerCase()}`, sourceCode: test.sourceCode, panel: test.name, name: test.name }));
  for (const test of standaloneHematologyTests) {
    const result = await definitions.updateMany(
      {
        $and: [
          { $or: [{ code: test.code }, { sourceWorkbook: mediLabWorkbookName, sourceTestCode: test.sourceCode }] },
          { $or: [{ panel: { $ne: test.panel } }, { name: { $ne: test.name } }, { subcategory: { $exists: true } }] },
        ],
      },
      { $set: { panel: test.panel, name: test.name, updatedAt: now }, $unset: { subcategory: "" } },
    );
    repaired += result.modifiedCount;
  }

  const movedTests = new Map<string, { panel: string; name: string; subcategory?: string }>([
    ...malariaFields.map((field) => [field.code, { panel: field.panel, name: field.name, ...("subcategory" in field ? { subcategory: field.subcategory } : {}) }] as const),
    ...standaloneTests.map((test) => [test.code, { panel: test.panel, name: test.name }] as const),
    ...standaloneHematologyTests.map((test) => [test.code, { panel: test.panel, name: test.name }] as const),
  ]);
  for (const test of standaloneHematologyTests) {
    const matches = await definitions.find(
      { $or: [{ code: test.code }, { sourceWorkbook: mediLabWorkbookName, sourceTestCode: test.sourceCode }] },
      { projection: { code: 1 } },
    ).toArray();
    for (const match of matches) movedTests.set(String(match.code), { panel: test.panel, name: test.name });
  }
  const orders = await database.collection<{ _id: unknown; tests: Array<Record<string, unknown>>; updatedAt: Date }>("labOrders")
    .find({ "tests.code": { $in: [...movedTests.keys()] } }).toArray();
  let updatedOrderCount = 0;
  for (const order of orders) {
    let changed = false;
    const tests = order.tests.map((test) => {
      const target = typeof test.code === "string" ? movedTests.get(test.code) : undefined;
      if (!target || (test.panel === target.panel && test.name === target.name && (test.subcategory ?? undefined) === target.subcategory)) return test;
      changed = true;
      const { subcategory: _oldSubcategory, ...rest } = test;
      return { ...rest, ...target };
    });
    if (changed) {
      const result = await database.collection("labOrders").updateOne({ _id: order._id, updatedAt: order.updatedAt }, { $set: { tests, updatedAt: now } });
      updatedOrderCount += result.modifiedCount;
    }
  }

  for (const sourceCode of malariaSourceCodesConsolidatedIntoPanel) {
    const result = await definitions.updateOne(
      { sourceWorkbook: mediLabWorkbookName, sourceTestCode: sourceCode, enabled: { $ne: false } },
      { $set: { enabled: false, sourceMatchStatus: "PANEL_COMPONENT_OVERLAP", updatedAt: now } },
    );
    repaired += result.modifiedCount;
  }

  if (repaired || updatedOrderCount) {
    await database.collection("auditEvents").insertOne({
      actorType: "SYSTEM",
      action: "catalogue.standalone_panels_repaired",
      recordType: "cataloguePanels",
      repairedCount: repaired,
      updatedOrderCount,
      createdAt: now,
    });
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export async function getDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new ConfigurationError(
      "MongoDB is not connected yet. Set the MONGODB_URI environment variable and restart or redeploy the app.",
    );
  }

  if (!global.mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      maxIdleTimeMS: 60_000,
    });
    global.mongoClientPromise = client.connect();
  }

  if (!global.lisDatabasePromise) {
    global.lisDatabasePromise = global.mongoClientPromise.then(async (client) => {
      const database = client.db();
      await Promise.all([
        database.collection("users").createIndex({ email: 1 }, { unique: true }),
        database.collection("chatMessages").createIndex({ createdAt: -1, _id: -1 }),
        database.collection("clients").createIndex({ patientId: 1 }, { unique: true }),
        database.collection("clients").createIndex({ fullName: 1 }),
        database.collection("labOrders").createIndex({ accessionId: 1 }, { unique: true }),
        database.collection("labOrders").createIndex({ clientId: 1, createdAt: -1 }),
        database.collection("labOrders").createIndex({ createdAt: -1 }),
        database.collection("labOrders").createIndex({ updatedAt: -1 }),
        database.collection("labOrders").createIndex({ "tests.panel": 1 }),
        database.collection("labOrders").createIndex({ "priceSnapshots.panel": 1 }),
        database.collection("testDefinitions").createIndex({ code: 1 }, { unique: true }),
        database.collection("testDefinitions").createIndex({ panel: 1, subcategory: 1, name: 1 }),
        database.collection("testDefinitions").createIndex({ panel: 1, enabled: 1 }),
        database.collection("testDefinitions").createIndex({ sourceWorkbook: 1, sourceTestCode: 1 }, { unique: true, sparse: true }),
        database.collection("cataloguePrices").createIndex({ panel: 1, effectiveFrom: -1 }, { unique: true }),
        database.collection("specimens").createIndex({ specimenId: 1 }, { unique: true }),
        database.collection("specimens").createIndex({ orderId: 1, status: 1 }),
        database.collection("specimens").createIndex({ patientId: 1, createdAt: -1 }),
        database.collection("qualityControlConfigs").createIndex({ testCode: 1, active: 1 }),
        database.collection("qualityControlRuns").createIndex({ testCode: 1, runAt: -1 }),
        database.collection("qualityControlRuns").createIndex({ configId: 1, runAt: -1 }),
        database.collection("auditEvents").createIndex({ createdAt: -1 }),
        database.collection("departments").createIndex({ code: 1 }, { unique: true }),
        database.collection("reagents").createIndex({ code: 1 }, { unique: true }),
        database.collection("reagents").createIndex({ name: 1 }),
        database.collection("reagents").createIndex({ departmentId: 1, active: 1 }),
        database.collection("reagentLots").createIndex({ reagentId: 1, lotNumber: 1 }, { unique: true }),
        database.collection("reagentLots").createIndex({ status: 1, expiryDate: 1 }),
        database.collection("reagentLots").createIndex({ storageLocationId: 1, status: 1 }),
        database.collection("reagentStorageLocations").createIndex({ code: 1 }, { unique: true }),
        database.collection("reagentStockMovements").createIndex({ lotId: 1, performedAt: -1 }),
        database.collection("reagentStockMovements").createIndex({ reagentId: 1, performedAt: -1 }),
        database.collection("reagentStockMovements").createIndex({ referenceType: 1, referenceId: 1, testCode: 1 }),
        database.collection("reagentVerifications").createIndex({ lotId: 1, performedAt: -1 }),
        database.collection("testReagentRequirements").createIndex({ testCode: 1, reagentId: 1, role: 1 }, { unique: true }),
      ]);
      const testDefinitions = database.collection("testDefinitions");
      const fullBloodCount = cataloguePanels.find((panel) => panel.code === "fbc");

      if (fullBloodCount) {
        const legacyInfectionTests = await testDefinitions
          .find({ panel: /^\s*infection screen\s*$/i })
          .toArray();

        for (const legacyTest of legacyInfectionTests) {
          const slug = String(legacyTest.name ?? "test")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
          let code = `fbc:${slug}`;
          const existingTest = await testDefinitions.findOne({ code });

          if (existingTest) {
            if (String(existingTest.name).toLowerCase() === String(legacyTest.name).toLowerCase()) {
              await testDefinitions.deleteOne({ _id: legacyTest._id });
              continue;
            }

            code = `${code}-${String(legacyTest._id).slice(-6)}`;
          }

          await testDefinitions.updateOne(
            { _id: legacyTest._id },
            { $set: { code, panel: fullBloodCount.name } },
          );
        }
      }

      // Keep the original AH/BH result codes so existing Widal orders and
      // catalogue entries continue to point at the same definitions.
      await testDefinitions.updateOne(
        { code: "widal:s-paratyphi-a-ah" },
        { $set: { name: "S. paratyphi A H (AH)", panel: "Widal" } },
      );
      await testDefinitions.updateOne(
        { code: "widal:s-paratyphi-b-bh" },
        { $set: { name: "S. paratyphi B H (BH)", panel: "Widal" } },
      );

      await database.collection("testDefinitions").bulkWrite(
        catalogueTests.map((test) => {
          return {
            updateOne: {
              filter: { code: test.code },
              update: {
                // Seed a definition once, but preserve administrator edits and
                // disabled catalogue entries on subsequent connections.
                $setOnInsert: { ...test, enabled: true, createdAt: new Date() },
              },
              upsert: true,
            },
          };
        }),
      );
      const removedFbcHeader = await testDefinitions.deleteMany({
        panel: { $in: ["Full Blood Count (FBC/CBC)", "Full Blood Count", "Infection Screen"] },
        name: /^\s*Full Blood Count(?:\s*\(FBC\/CBC\))?\s*$/i,
      });
      if (removedFbcHeader.deletedCount) {
        await database.collection("auditEvents").insertOne({
          actorType: "SYSTEM",
          action: "catalogue.duplicate_fbc_panel_header_removed",
          recordType: "cataloguePanels",
          removedDefinitionCount: removedFbcHeader.deletedCount,
          createdAt: new Date(),
        });
      }
      // Run compatibility and catalogue repairs only during database startup.
      // Keeping these outside the connection promise made every page/action
      // repeat a sequence of reads and writes before using the database.
      await repairFbcComponentDuplicates(database);
      await repairMalariaPanelDefinitions(database);
      await repairDefaultPanelDepartments(database);
      return database;
    });
  }

  try {
    return await global.lisDatabasePromise;
  } catch (error) {
    global.mongoClientPromise = undefined;
    global.lisDatabasePromise = undefined;
    throw error;
  }
}
