"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { requireUser } from "@/lib/session";
import type { CatalogueTest } from "@/lib/catalogue";
import type { DepartmentRecord } from "@/lib/models";
import { catalogueDepartmentDefaults, recommendedDepartmentCode, normalizeDepartmentName } from "@/lib/department-catalogue";
import { malariaSourceCodesConsolidatedIntoPanel, mediLabWorkbookName, normalizeCatalogueName } from "@/lib/catalogue-import";
import { mediLabCatalogueSource } from "@/lib/medilab-catalogue-source";
import { syncOpenOrdersForPanels } from "@/lib/catalogue-sync";

type Definition = CatalogueTest & { _id: ObjectId; enabled: boolean; createdAt?: Date };

const fbcComponentOverlaps: Record<string, string> = {
  "HEM-003": "fbc:haemoglobin",
};

const standaloneSourceMatches: Record<string, string> = {
  "HEM-007": "platelet-count:platelet-count",
};
const standaloneHematologySourceCodes = new Set(["HEM-004", "HEM-005", "HEM-006", "HEM-008", "HEM-009"]);

function panelName(row: (typeof mediLabCatalogueSource)[number]): string {
  if ((row.sourceCode.startsWith("ANC-") && row.resultType !== "Profile") || row.sourceCode.startsWith("POC-")) return row.name;
  if (standaloneHematologySourceCodes.has(row.sourceCode)) return row.name;
  return mediLabCatalogueSource.find((candidate) => candidate.category === row.category && candidate.subcategory === row.subcategory && candidate.resultType === "Profile")?.name ?? row.subcategory;
}

export async function importMediLabCatalogue(): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const database = await getDatabase();
  const departmentsCollection = database.collection<DepartmentRecord>("departments");
  const departments = await departmentsCollection.find().toArray();
  const departmentByStandardCode = new Map<string, DepartmentRecord>();
  const codes = new Set(departments.map((item) => item.code.toUpperCase()));

  for (const standard of catalogueDepartmentDefaults) {
    const aliases = new Set([standard.name, ...standard.aliases].map(normalizeDepartmentName));
    let department = departments.find((item) => aliases.has(normalizeDepartmentName(item.name)));
    if (!department) {
      let code = standard.code;
      let suffix = 2;
      while (codes.has(code.toUpperCase())) code = `${standard.code}_${suffix++}`;
      const now = new Date();
      department = { _id: new ObjectId(), code, name: standard.name, departmentKind: standard.kind, active: true, createdAt: now, updatedAt: now, createdBy: actor._id.toHexString() };
      await departmentsCollection.insertOne(department);
      departments.push(department);
      codes.add(code.toUpperCase());
    }
    departmentByStandardCode.set(standard.code, department);
  }

  const definitions = database.collection<Definition>("testDefinitions");
  const existingDefinitions = await definitions.find().toArray();
  const usedCodes = new Set(existingDefinitions.map((item) => item.code));
  let created = 0;
  let matched = 0;
  const panelsToSync = new Set<string>();

  for (const row of mediLabCatalogueSource) {
    const standardDepartment = departmentByStandardCode.get(recommendedDepartmentCode(row));
    if (!standardDepartment) continue;
    const targetPanel = panelName(row);
    const existingSource = await definitions.findOne({ sourceWorkbook: mediLabWorkbookName, sourceTestCode: row.sourceCode });

    if (malariaSourceCodesConsolidatedIntoPanel.some((sourceCode) => sourceCode === row.sourceCode)) {
      if (existingSource) {
        await definitions.updateOne({ _id: existingSource._id }, {
          $set: { enabled: false, sourceMatchStatus: "PANEL_COMPONENT_OVERLAP", updatedAt: new Date() },
        });
        panelsToSync.add(existingSource.panel);
      }
      matched++;
      continue;
    }

    const overlappingComponentCode = fbcComponentOverlaps[row.sourceCode];
    if (overlappingComponentCode) {
      const component = await definitions.findOne({ code: overlappingComponentCode });
      if (component) {
        const now = new Date();
        await definitions.updateOne({ _id: component._id }, {
          $set: {
            sourceWorkbook: mediLabWorkbookName,
            sourceTestCode: row.sourceCode,
            sourceCategory: row.category,
            sourceSubcategory: row.subcategory,
            sourceContainer: row.container,
            sourceMethod: row.method,
            sourceProcessingLocation: row.processingLocation,
            sourceConfigurationNotes: row.configurationNotes,
            sourceResultType: row.resultType,
            sourceMatchStatus: "PANEL_COMPONENT_OVERLAP",
            updatedAt: now,
          },
        });
        if (existingSource && String(existingSource._id) !== String(component._id)) {
          await definitions.updateOne({ _id: existingSource._id }, {
            $set: { enabled: false, sourceMatchStatus: "PANEL_COMPONENT_OVERLAP", updatedAt: now },
            $unset: { sourceWorkbook: "", sourceTestCode: "" },
          });
          panelsToSync.add(existingSource.panel);
        }
        matched++;
        continue;
      }
    }

    const standaloneCode = standaloneSourceMatches[row.sourceCode];
    if (standaloneCode) {
      const standaloneTest = await definitions.findOne({ code: standaloneCode });
      if (standaloneTest) {
        const now = new Date();
        await definitions.updateOne({ _id: standaloneTest._id }, {
          $set: {
            sourceWorkbook: mediLabWorkbookName,
            sourceTestCode: row.sourceCode,
            sourceCategory: row.category,
            sourceSubcategory: row.subcategory,
            sourceContainer: row.container,
            sourceMethod: row.method,
            sourceProcessingLocation: row.processingLocation,
            sourceConfigurationNotes: row.configurationNotes,
            sourceResultType: row.resultType,
            sourceMatchStatus: "EXISTING_MATCH",
            updatedAt: now,
          },
        });
        if (existingSource && String(existingSource._id) !== String(standaloneTest._id)) {
          await definitions.updateOne({ _id: existingSource._id }, {
            $set: { enabled: false, sourceMatchStatus: "PANEL_COMPONENT_OVERLAP", updatedAt: now },
            $unset: { sourceWorkbook: "", sourceTestCode: "" },
          });
          panelsToSync.add(existingSource.panel);
        }
        matched++;
        continue;
      }
    }

    if (existingSource) {
      if (standaloneHematologySourceCodes.has(row.sourceCode)) {
        await definitions.updateOne({ _id: existingSource._id }, {
          $set: { panel: targetPanel, name: row.name, updatedAt: new Date() },
          $unset: { subcategory: "" },
        });
        panelsToSync.add(existingSource.panel);
        panelsToSync.add(targetPanel);
      }
      continue;
    }

    const exactMatches = existingDefinitions.filter((item) => normalizeCatalogueName(item.name) === normalizeCatalogueName(row.name));
    if (exactMatches.length === 1) {
      const current = exactMatches[0];
      const currentDepartment = current.departmentCode && departments.find((item) => item.code === current.departmentCode && item.active);
      await definitions.updateOne({ _id: current._id }, { $set: {
        sourceWorkbook: mediLabWorkbookName,
        sourceTestCode: row.sourceCode,
        sourceCategory: row.category,
        sourceSubcategory: row.subcategory,
        sourceContainer: row.container,
        sourceMethod: row.method,
        sourceProcessingLocation: row.processingLocation,
        sourceConfigurationNotes: row.configurationNotes,
        sourceResultType: row.resultType,
        sourceMatchStatus: "EXISTING_MATCH",
        ...(current.requiresClinicalReview ? { enabled: true } : {}),
        ...(currentDepartment ? {} : { departmentCode: standardDepartment.code }),
        ...(standaloneHematologySourceCodes.has(row.sourceCode) ? { panel: targetPanel } : {}),
        ...(row.resultType === "Profile" ? { panel: targetPanel, panelHeaderOnly: true, sourcePanelParametersRequired: true } : {}),
        ...(row.sourceCode.startsWith("POC-") ? { sourceWorkflow: "POCT" as const } : {}),
        updatedAt: new Date(),
      }, $unset: { clinicalReviewStatus: "", requiresClinicalReview: "", ...(standaloneHematologySourceCodes.has(row.sourceCode) ? { subcategory: "" } : {}) } });
      panelsToSync.add(current.panel);
      panelsToSync.add(targetPanel);
      matched++;
      continue;
    }

    let code = `mlis:${row.sourceCode.toLowerCase()}`;
    if (usedCodes.has(code)) code = `${code}:source`;
    if (usedCodes.has(code)) continue;
    usedCodes.add(code);
    const kind: CatalogueTest["kind"] = row.resultType === "Numeric" ? "numeric" : row.resultType === "Qualitative" ? "qualitative" : "narrative";
    const record: Definition = {
      _id: new ObjectId(), code, panel: targetPanel, name: row.name, kind,
      unit: /configure|method-specific|component-specific/i.test(row.unit) ? "" : row.unit,
      sourceReference: row.referenceInterval, referenceApproved: false,
      specimenType: row.specimen, departmentCode: standardDepartment.code,
      ...(!standaloneHematologySourceCodes.has(row.sourceCode) ? { subcategory: row.subcategory } : {}), sourceWorkbook: mediLabWorkbookName,
      sourceTestCode: row.sourceCode, sourceCategory: row.category, sourceSubcategory: row.subcategory,
      sourceContainer: row.container, sourceMethod: row.method,
      sourceProcessingLocation: row.processingLocation,
      sourceConfigurationNotes: row.configurationNotes, sourceResultType: row.resultType,
      ...(row.sourceCode.startsWith("POC-") ? { sourceWorkflow: "POCT" as const } : {}),
      ...(row.resultType === "Profile" ? { panelHeaderOnly: true, sourcePanelParametersRequired: true } : {}),
      sourceMatchStatus: exactMatches.length > 1 || row.resultType === "Profile" ? "REVIEW_REQUIRED" : "NEW",
      enabled: true,
      createdAt: new Date(),
    };
    await definitions.insertOne(record);
    existingDefinitions.push(record);
    panelsToSync.add(targetPanel);
    created++;
  }

  await syncOpenOrdersForPanels(database, panelsToSync);
  await database.collection("auditEvents").insertOne({ actorId: actor._id, action: "catalogue.source_import_completed", recordType: "catalogueImport", sourceWorkbook: mediLabWorkbookName, sourceRows: mediLabCatalogueSource.length, created, matched, createdAt: new Date() });
  for (const path of ["/catalogue", "/catalogue/import", "/departments", "/orders/new", "/worklist", "/reagents"]) revalidatePath(path);
  redirect(`/catalogue/import?notice=imported&created=${created}&matched=${matched}`);
}
