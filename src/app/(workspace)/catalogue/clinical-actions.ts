"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/mongodb";
import { requireUser } from "@/lib/session";
import type { CatalogueTest } from "@/lib/catalogue";
import type { DepartmentRecord } from "@/lib/models";
import { isGenericCatalogueValue } from "@/lib/catalogue-import";
import { syncOpenOrdersForPanel } from "@/lib/catalogue-sync";

export async function approveImportedCatalogueTest(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/catalogue?error=missing");
  const database = await getDatabase();
  const definitions = database.collection<CatalogueTest & { enabled: boolean }>("testDefinitions");
  const test = await definitions.findOne({ code, requiresClinicalReview: true });
  if (!test) redirect("/catalogue?error=missing");
  if (!test.departmentCode || !await database.collection<DepartmentRecord>("departments").findOne({ code: test.departmentCode, active: true })) redirect("/catalogue?error=clinical-department-required");
  if (isGenericCatalogueValue(test.specimenType) || isGenericCatalogueValue(test.sourceContainer) || isGenericCatalogueValue(test.sourceMethod)) redirect("/catalogue?error=clinical-configuration-required");
  if (test.sourceAvailability !== "IN_HOUSE") redirect("/catalogue?error=in-house-confirmation-required");
  if (test.kind === "numeric" && (!test.unit.trim() || isGenericCatalogueValue(test.unit) || !test.sourceReference.trim() || isGenericCatalogueValue(test.sourceReference) || test.referenceApproved !== true)) redirect("/catalogue?error=reference-approval-required");
  if (test.sourcePanelParametersRequired) {
    const component = await definitions.findOne({ panel: test.panel, code: { $ne: test.code }, enabled: { $ne: false } });
    if (!component) redirect("/catalogue?error=profile-components-required");
  }
  await definitions.updateOne({ _id: test._id }, { $set: { clinicalReviewStatus: "APPROVED", updatedAt: new Date() } });
  await syncOpenOrdersForPanel(database, test.panel);
  await database.collection("auditEvents").insertOne({ actorId: actor._id, action: "catalogue.clinical_review_approved", recordType: "testDefinition", recordId: test._id, testCode: test.code, departmentCode: test.departmentCode, sourceWorkbook: test.sourceWorkbook, createdAt: new Date() });
  revalidatePath("/catalogue");
  revalidatePath("/orders/new");
  redirect("/catalogue?notice=clinical-review-approved");
}
