"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/mongodb";
import { requireUser } from "@/lib/session";
import type { CataloguePriceRecord, DepartmentRecord, LabOrder } from "@/lib/models";
import { syncOpenOrdersForPanels } from "@/lib/catalogue-sync";

export async function renameCataloguePanel(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const panel = String(formData.get("panel") ?? "").trim();
  const newPanel = String(formData.get("newPanel") ?? "").trim();
  const sourcePanels = [...new Set(formData.getAll("sourcePanels").filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()))];
  if (!panel || !newPanel || newPanel.length > 120 || sourcePanels.length === 0 || sourcePanels.length > 20) redirect("/catalogue?error=panel-rename-validation");

  const database = await getDatabase();
  const definitions = database.collection("testDefinitions");
  const sourceFilter = { panel: { $in: sourcePanels } };
  if (!await definitions.findOne(sourceFilter, { projection: { _id: 1 } })) redirect("/catalogue?error=panel-missing");
  if (sourcePanels.includes(newPanel)) redirect("/catalogue?notice=panel-renamed");
  if (await definitions.findOne({ panel: newPanel }, { projection: { _id: 1 } })) redirect("/catalogue?error=duplicate-panel-name");

  const prices = database.collection<CataloguePriceRecord>("cataloguePrices");
  const priceHistory = await prices.find({ panel: { $in: [...sourcePanels, newPanel] } }).toArray();
  const priceDates = new Set<number>();
  for (const price of priceHistory) {
    const effectiveTime = new Date(price.effectiveFrom).getTime();
    if (priceDates.has(effectiveTime)) redirect("/catalogue?error=panel-price-conflict");
    priceDates.add(effectiveTime);
  }

  const now = new Date();
  const definitionUpdate = await definitions.updateMany(sourceFilter, { $set: { panel: newPanel, updatedAt: now } });
  await prices.updateMany({ panel: { $in: sourcePanels } }, { $set: { panel: newPanel } });

  const sourcePanelSet = new Set(sourcePanels);
  const orders = await database.collection<LabOrder>("labOrders").find({
    $or: [{ "tests.panel": { $in: sourcePanels } }, { "priceSnapshots.panel": { $in: sourcePanels } }],
    authorizedAt: { $exists: false },
    reportVersions: { $exists: false },
    pendingAmendment: { $exists: false },
  }).toArray();
  let changedOrderCount = 0;
  for (const order of orders) {
    const tests = order.tests.map((test) => sourcePanelSet.has(test.panel) ? { ...test, panel: newPanel } : test);
    const priceSnapshots = order.priceSnapshots?.map((snapshot) => sourcePanelSet.has(snapshot.panel) ? { ...snapshot, panel: newPanel } : snapshot);
    await database.collection<LabOrder>("labOrders").updateOne(
      { _id: order._id, authorizedAt: { $exists: false }, reportVersions: { $exists: false }, pendingAmendment: { $exists: false } },
      { $set: { tests, ...(priceSnapshots ? { priceSnapshots } : {}), updatedAt: now } },
    );
    changedOrderCount += 1;
  }
  await syncOpenOrdersForPanels(database, [...sourcePanels, newPanel]);

  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: "catalogue.panel_renamed",
    recordType: "cataloguePanel",
    panel,
    newPanel,
    sourcePanels,
    changedDefinitionCount: definitionUpdate.modifiedCount,
    changedOrderCount,
    changedFields: ["panel"],
    createdAt: now,
  });
  for (const path of ["/catalogue", "/departments", "/orders", "/orders/new", "/worklist", "/reports", "/reagents"]) revalidatePath(path);
  redirect("/catalogue?notice=panel-renamed");
}

export async function updateCataloguePanelDepartment(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const panel = String(formData.get("panel") ?? "").trim();
  const departmentCode = String(formData.get("departmentCode") ?? "").trim();
  const sourcePanels = [...new Set(formData.getAll("sourcePanels").filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()))];
  if (!panel || panel.length > 120 || sourcePanels.length === 0 || sourcePanels.length > 20) redirect("/catalogue?error=panel-department-validation");

  const database = await getDatabase();
  if (departmentCode && !await database.collection<DepartmentRecord>("departments").findOne({ code: departmentCode, active: true, departmentKind: { $ne: "ORDER_GROUP" } })) redirect("/catalogue?error=invalid-department");
  const filter = { panel: { $in: sourcePanels } };
  const definitions = database.collection("testDefinitions");
  if (!await definitions.findOne(filter, { projection: { _id: 1 } })) redirect("/catalogue?error=panel-missing");

  const now = new Date();
  const update = departmentCode
    ? await definitions.updateMany(filter, { $set: { departmentCode, updatedAt: now } })
    : await definitions.updateMany(filter, { $unset: { departmentCode: "" }, $set: { updatedAt: now } });
  await syncOpenOrdersForPanels(database, sourcePanels);
  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: "catalogue.panel_department_updated",
    recordType: "cataloguePanel",
    panel,
    sourcePanels,
    departmentCode: departmentCode || undefined,
    changedDefinitionCount: update.modifiedCount,
    changedFields: ["departmentCode"],
    createdAt: now,
  });
  for (const path of ["/catalogue", "/departments", "/orders/new", "/worklist", "/reagents"]) revalidatePath(path);
  redirect("/catalogue?notice=panel-department-updated");
}
