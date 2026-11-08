"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDatabase } from "@/lib/mongodb";
import { requireUser } from "@/lib/session";
import type { DepartmentRecord } from "@/lib/models";
import { catalogueDepartmentDefaults, normalizeDepartmentName } from "@/lib/department-catalogue";

function fail(code: string): never {
  redirect(`/departments?error=${encodeURIComponent(code)}`);
}

export async function initializeWorkbookDepartments(): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const database = await getDatabase();
  const collection = database.collection<DepartmentRecord>("departments");
  const existing = await collection.find().toArray();
  const codes = new Set(existing.map((department) => department.code.toUpperCase()));
  const now = new Date();
  let created = 0;
  let reused = 0;

  for (const definition of catalogueDepartmentDefaults) {
    const aliases = new Set([definition.name, ...definition.aliases].map(normalizeDepartmentName));
    const match = existing.find((department) => aliases.has(normalizeDepartmentName(department.name)));
    if (match) {
      await collection.updateOne({ _id: match._id }, { $set: { departmentKind: definition.kind, updatedAt: now } });
      reused++;
      continue;
    }
    let code = definition.code;
    let suffix = 2;
    while (codes.has(code.toUpperCase())) code = `${definition.code.slice(0, 20)}_${suffix++}`;
    const record: DepartmentRecord = {
      _id: new ObjectId(), code, name: definition.name, departmentKind: definition.kind, active: true,
      createdAt: now, updatedAt: now, createdBy: actor._id.toHexString(),
    };
    await collection.insertOne(record);
    existing.push(record);
    codes.add(code.toUpperCase());
    created++;
  }

  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: "department.workbook_defaults_initialized",
    recordType: "department",
    createdCount: created,
    reusedCount: reused,
    source: "department-catalogue-defaults",
    createdAt: now,
  });
  revalidatePath("/departments");
  revalidatePath("/reagents");
  revalidatePath("/reagents/settings");
  redirect(`/departments?notice=defaults-ready&created=${created}&reused=${reused}`);
}

const customDepartmentSchema = z.object({
  code: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(100),
});

export async function createLabDepartment(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const parsed = customDepartmentSchema.safeParse({
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    name: String(formData.get("name") ?? "").trim(),
  });
  if (!parsed.success) fail("validation");

  const database = await getDatabase();
  const existing = await database.collection<DepartmentRecord>("departments").find().toArray();
  const normalizedName = normalizeDepartmentName(parsed.data.name);
  if (existing.some((item) => normalizeDepartmentName(item.name) === normalizedName || item.code.toUpperCase() === parsed.data.code)) fail("duplicate-department");
  if (catalogueDepartmentDefaults.some((definition) => [definition.name, ...definition.aliases].some((name) => normalizeDepartmentName(name) === normalizedName)) || normalizeDepartmentName("Point-of-Care Testing") === normalizedName) fail("reserved-department-name");
  const now = new Date();
  try {
    const result = await database.collection<DepartmentRecord>("departments").insertOne({
      _id: new ObjectId(), ...parsed.data, active: true, createdAt: now, updatedAt: now, createdBy: actor._id.toHexString(),
    });
    await database.collection("auditEvents").insertOne({
      actorId: actor._id,
      action: "department.created",
      recordType: "department",
      recordId: result.insertedId,
      code: parsed.data.code,
      name: parsed.data.name,
      createdAt: now,
    });
  } catch {
    fail("duplicate-department");
  }

  revalidatePath("/departments");
  revalidatePath("/reagents");
  revalidatePath("/reagents/settings");
  redirect("/departments?notice=department-created");
}
