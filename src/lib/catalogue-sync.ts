import "server-only";

import { revalidatePath } from "next/cache";
import type { Db } from "mongodb";
import type { CatalogueTest } from "@/lib/catalogue";
import type { DepartmentRecord, LabOrder, OrderedTest } from "@/lib/models";
import { overallOrderStatus } from "@/lib/workflow";

/** Reconcile pending, unreleased order snapshots with the live test catalogue. */
export async function syncOpenOrdersForPanels(database: Db, panelNames: Iterable<string>): Promise<void> {
  const panels = [...new Set([...panelNames].map((panel) => panel.trim()).filter(Boolean))];
  if (!panels.length) return;

  const [definitions, departments, orders] = await Promise.all([
    database.collection<CatalogueTest & { enabled?: boolean }>("testDefinitions")
      .find({ panel: { $in: panels }, enabled: { $ne: false }, panelHeaderOnly: { $ne: true } }).toArray(),
    database.collection<DepartmentRecord>("departments").find({ active: true }).toArray(),
    database.collection<LabOrder>("labOrders").find({
      $or: [{ "priceSnapshots.panel": { $in: panels } }, { "tests.panel": { $in: panels } }],
      authorizedAt: { $exists: false },
      reportVersions: { $exists: false },
      pendingAmendment: { $exists: false },
    }).toArray(),
  ]);

  const panelSet = new Set(panels);
  const definitionByCode = new Map(definitions.map((definition) => [definition.code, definition]));
  const departmentNames = new Map(departments.map((department) => [department.code, department.name]));
  const updates: Array<{ updateOne: { filter: Record<string, unknown>; update: { $set: { tests: OrderedTest[]; status: LabOrder["status"]; updatedAt: Date } } } }> = [];
  const now = new Date();

  for (const order of orders) {
    let changed = false;
    const selectedPanels = new Set(order.priceSnapshots?.length
      ? order.priceSnapshots.map((snapshot) => snapshot.panel)
      : order.tests.map((test) => test.panel));
    const tests = order.tests.flatMap((test) => {
      if (!panelSet.has(test.panel)) return [test];
      const definition = definitionByCode.get(test.code);
      if (!definition || !selectedPanels.has(definition.panel)) {
        // Preserve any row staff have started; remove only untouched pending rows.
        if (test.status === "Pending" && !test.result.trim()) { changed = true; return []; }
        return [test];
      }
      if (test.status !== "Pending" || test.result.trim()) return [test];

      const { departmentCode: _oldDepartmentCode, departmentName: _oldDepartmentName, subcategory: _oldSubcategory, ...unchanged } = test;
      const updated: OrderedTest = {
        ...unchanged,
        panel: definition.panel,
        ...(definition.subcategory ? { subcategory: definition.subcategory } : {}),
        name: definition.name,
        kind: definition.kind,
        unit: definition.unit,
        sourceReference: definition.sourceReference,
        referenceApproved: definition.referenceApproved,
        specimenType: test.specimenType || definition.specimenType || "",
        ...(definition.departmentCode ? {
          departmentCode: definition.departmentCode,
          ...(departmentNames.get(definition.departmentCode) ? { departmentName: departmentNames.get(definition.departmentCode) } : {}),
        } : {}),
      };
      if (JSON.stringify(updated) !== JSON.stringify(test)) changed = true;
      return [updated];
    });

    for (const definition of definitions) {
      if (!selectedPanels.has(definition.panel)) continue;
      if (tests.some((test) => test.code === definition.code)) continue;
      tests.push({
        code: definition.code,
        panel: definition.panel,
        ...(definition.subcategory ? { subcategory: definition.subcategory } : {}),
        name: definition.name,
        kind: definition.kind,
        unit: definition.unit,
        sourceReference: definition.sourceReference,
        referenceApproved: definition.referenceApproved,
        specimenType: definition.specimenType || "",
        ...(definition.departmentCode ? {
          departmentCode: definition.departmentCode,
          ...(departmentNames.get(definition.departmentCode) ? { departmentName: departmentNames.get(definition.departmentCode) } : {}),
        } : {}),
        status: "Pending",
        result: "",
      });
      changed = true;
    }

    if (changed) updates.push({
      updateOne: {
        filter: {
          _id: order._id,
          updatedAt: order.updatedAt,
          authorizedAt: { $exists: false },
          reportVersions: { $exists: false },
          pendingAmendment: { $exists: false },
        },
        update: { $set: { tests, status: overallOrderStatus(tests.map((test) => test.status)), updatedAt: now } },
      },
    });
  }

  if (updates.length) {
    const result = await database.collection<LabOrder>("labOrders").bulkWrite(updates, { ordered: false });
    if (result.modifiedCount) {
      revalidatePath("/orders");
      revalidatePath("/orders/[id]", "page");
      revalidatePath("/worklist");
      revalidatePath("/reports");
      revalidatePath("/reports/[id]", "page");
    }
  }
}

export async function syncOpenOrdersForPanel(database: Db, panel: string): Promise<void> {
  return syncOpenOrdersForPanels(database, [panel]);
}
