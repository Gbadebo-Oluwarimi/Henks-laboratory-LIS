"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId, type ClientSession } from "mongodb";
import { z } from "zod";

import { getDatabase } from "@/lib/mongodb";
import { hasPermission, requireUser } from "@/lib/session";
import { canUseLot, isLotExpired, lotEffectiveStatus, nextLotStatus, parseDateOnly } from "@/lib/reagents";
import type {
  DepartmentRecord,
  LabOrder,
  ReagentCategory,
  ReagentLotRecord,
  ReagentRecord,
  ReagentStockMovementRecord,
  ReagentStorageLocationRecord,
  ReagentStorageType,
  ReagentVerificationRecord,
  TestReagentRequirementRecord,
  UserPermission,
} from "@/lib/models";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(code: string): never {
  redirect(`/reagents?error=${encodeURIComponent(code)}`);
}

async function actorFor(permission: UserPermission) {
  const user = await requireUser();
  if (!hasPermission(user, permission)) fail("forbidden");
  return user;
}

async function audit(
  actorId: ObjectId,
  action: string,
  entityType: string,
  entityId: ObjectId,
  metadata: Record<string, unknown> = {},
  session?: ClientSession,
) {
  const database = await getDatabase();
  await database.collection("auditEvents").insertOne({
    actorId,
    action,
    recordType: entityType,
    recordId: entityId,
    createdAt: new Date(),
    ...metadata,
  }, session ? { session } : undefined);
}

function revalidateReagentViews(reagentId?: string, lotId?: string) {
  revalidatePath("/reagents");
  revalidatePath("/reagents/definitions");
  revalidatePath("/reagents/lots");
  revalidatePath("/reagents/settings");
  if (reagentId) revalidatePath(`/reagents/definitions/${reagentId}`);
  if (lotId) revalidatePath(`/reagents/lots/${lotId}`);
}

const departmentSchema = z.object({
  code: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(100),
});

export async function createDepartment(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:manage");
  const parsed = departmentSchema.safeParse({ code: field(formData, "code").toUpperCase(), name: field(formData, "name") });
  if (!parsed.success) fail("validation");
  const database = await getDatabase();
  const now = new Date();
  try {
    const result = await database.collection<DepartmentRecord>("departments").insertOne({
      _id: new ObjectId(), ...parsed.data, active: true, createdAt: now, updatedAt: now, createdBy: actor._id.toHexString(),
    });
    await audit(actor._id, "reagent.department_created", "department", result.insertedId, { code: parsed.data.code, name: parsed.data.name });
  } catch {
    fail("duplicate-department");
  }
  revalidateReagentViews();
  redirect("/reagents/settings?notice=department-created");
}

export async function toggleDepartmentActive(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:manage");
  const departmentId = field(formData, "departmentId");
  if (!ObjectId.isValid(departmentId)) fail("validation");
  const database = await getDatabase();
  const department = await database.collection<DepartmentRecord>("departments").findOne({ _id: new ObjectId(departmentId) });
  if (!department) fail("missing-department");
  if (department.active && await database.collection<ReagentRecord>("reagents").findOne({ departmentId: department._id, active: true })) fail("department-in-use");
  await database.collection<DepartmentRecord>("departments").updateOne({ _id: department._id }, { $set: { active: !department.active, updatedAt: new Date() } });
  await audit(actor._id, department.active ? "reagent.department_deactivated" : "reagent.department_activated", "department", department._id, { code: department.code });
  revalidateReagentViews();
  redirect("/reagents/settings?notice=department-updated");
}

const storageSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(100),
  type: z.enum(["LABORATORY", "DEPARTMENT", "STORE", "ROOM", "REFRIGERATOR", "FREEZER", "SHELF", "BIN"]),
  parentId: z.string().optional(),
  departmentId: z.string().optional(),
  temperatureRange: z.string().trim().max(80).optional(),
});

export async function createStorageLocation(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:manage");
  const parsed = storageSchema.safeParse({
    code: field(formData, "code").toUpperCase(), name: field(formData, "name"), type: field(formData, "type"),
    parentId: field(formData, "parentId") || undefined, departmentId: field(formData, "departmentId") || undefined,
    temperatureRange: field(formData, "temperatureRange") || undefined,
  });
  if (!parsed.success || (parsed.data.parentId && !ObjectId.isValid(parsed.data.parentId)) || (parsed.data.departmentId && !ObjectId.isValid(parsed.data.departmentId))) fail("validation");
  const database = await getDatabase();
  const locations = database.collection<ReagentStorageLocationRecord>("reagentStorageLocations");
  if (parsed.data.parentId && !await locations.findOne({ _id: new ObjectId(parsed.data.parentId), active: true })) fail("missing-location");
  if (parsed.data.departmentId && !await database.collection<DepartmentRecord>("departments").findOne({ _id: new ObjectId(parsed.data.departmentId), active: true, departmentKind: { $ne: "ORDER_GROUP" } })) fail("missing-department");
  const now = new Date();
  try {
    const result = await locations.insertOne({
      _id: new ObjectId(), code: parsed.data.code, name: parsed.data.name, type: parsed.data.type as ReagentStorageType,
      ...(parsed.data.parentId ? { parentId: new ObjectId(parsed.data.parentId) } : {}),
      ...(parsed.data.departmentId ? { departmentId: new ObjectId(parsed.data.departmentId) } : {}),
      ...(parsed.data.temperatureRange ? { temperatureRange: parsed.data.temperatureRange } : {}),
      active: true, createdAt: now, updatedAt: now, createdBy: actor._id.toHexString(),
    });
    await audit(actor._id, "reagent.storage_location_created", "reagentStorageLocation", result.insertedId, { code: parsed.data.code });
  } catch {
    fail("duplicate-location");
  }
  revalidateReagentViews();
  redirect("/reagents/settings?notice=location-created");
}

export async function toggleStorageLocationActive(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:manage");
  const locationId = field(formData, "locationId");
  if (!ObjectId.isValid(locationId)) fail("validation");
  const database = await getDatabase();
  const location = await database.collection<ReagentStorageLocationRecord>("reagentStorageLocations").findOne({ _id: new ObjectId(locationId) });
  if (!location) fail("missing-location");
  if (location.active && await database.collection<ReagentLotRecord>("reagentLots").findOne({ storageLocationId: location._id })) fail("location-in-use");
  await database.collection<ReagentStorageLocationRecord>("reagentStorageLocations").updateOne({ _id: location._id }, { $set: { active: !location.active, updatedAt: new Date() } });
  await audit(actor._id, location.active ? "reagent.storage_location_deactivated" : "reagent.storage_location_activated", "reagentStorageLocation", location._id, { code: location.code });
  revalidateReagentViews();
  redirect("/reagents/settings?notice=location-updated");
}

const reagentSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  category: z.enum(["Chemistry", "Haematology", "Microbiology", "Immunology", "Serology", "Coagulation", "Molecular Biology", "Other"]),
  departmentId: z.string().regex(/^[a-f\d]{24}$/i),
  manufacturer: z.string().trim().max(120).optional(),
  catalogueNumber: z.string().trim().max(80).optional(),
  unitOfIssue: z.string().trim().min(1).max(40),
  defaultStorageCondition: z.string().trim().max(120).optional(),
  minimumStock: z.coerce.number().min(0).optional(),
  maximumStock: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0),
  inUseStabilityDays: z.coerce.number().int().positive().max(3650).optional(),
});

function reagentInput(formData: FormData) {
  return reagentSchema.safeParse({
    code: field(formData, "code").toUpperCase(), name: field(formData, "name"), description: field(formData, "description") || undefined,
    category: field(formData, "category"), departmentId: field(formData, "departmentId"), manufacturer: field(formData, "manufacturer") || undefined,
    catalogueNumber: field(formData, "catalogueNumber") || undefined, unitOfIssue: field(formData, "unitOfIssue"),
    defaultStorageCondition: field(formData, "defaultStorageCondition") || undefined,
    minimumStock: field(formData, "minimumStock") === "" ? undefined : field(formData, "minimumStock"),
    maximumStock: field(formData, "maximumStock") === "" ? undefined : field(formData, "maximumStock"),
    reorderLevel: field(formData, "reorderLevel"),
    inUseStabilityDays: field(formData, "inUseStabilityDays") === "" ? undefined : field(formData, "inUseStabilityDays"),
  });
}

export async function createReagent(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:manage");
  const parsed = reagentInput(formData);
  if (!parsed.success || (parsed.data.minimumStock !== undefined && parsed.data.maximumStock !== undefined && parsed.data.minimumStock > parsed.data.maximumStock)) fail("validation");
  const database = await getDatabase();
  const department = await database.collection<DepartmentRecord>("departments").findOne({ _id: new ObjectId(parsed.data.departmentId), active: true, departmentKind: { $ne: "ORDER_GROUP" } });
  if (!department) fail("missing-department");
  const now = new Date();
  const reagent: ReagentRecord = {
    _id: new ObjectId(), code: parsed.data.code, name: parsed.data.name, category: parsed.data.category as ReagentCategory,
    departmentId: department._id, unitOfIssue: parsed.data.unitOfIssue, reorderLevel: parsed.data.reorderLevel,
    ...(parsed.data.description ? { description: parsed.data.description } : {}),
    ...(parsed.data.manufacturer ? { manufacturer: parsed.data.manufacturer } : {}),
    ...(parsed.data.catalogueNumber ? { catalogueNumber: parsed.data.catalogueNumber } : {}),
    ...(parsed.data.defaultStorageCondition ? { defaultStorageCondition: parsed.data.defaultStorageCondition } : {}),
    ...(parsed.data.minimumStock !== undefined ? { minimumStock: parsed.data.minimumStock } : {}),
    ...(parsed.data.maximumStock !== undefined ? { maximumStock: parsed.data.maximumStock } : {}),
    ...(parsed.data.inUseStabilityDays !== undefined ? { inUseStabilityDays: parsed.data.inUseStabilityDays } : {}),
    active: true, createdAt: now, updatedAt: now, createdBy: actor._id.toHexString(), updatedBy: actor._id.toHexString(),
  };
  try {
    await database.collection<ReagentRecord>("reagents").insertOne(reagent);
  } catch {
    fail("duplicate-reagent");
  }
  await audit(actor._id, "reagent.created", "reagent", reagent._id, { code: reagent.code, name: reagent.name });
  revalidateReagentViews(reagent._id.toHexString());
  redirect(`/reagents/definitions/${reagent._id.toHexString()}?notice=created`);
}

export async function updateReagent(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:manage");
  const reagentId = field(formData, "reagentId");
  const parsed = reagentInput(formData);
  if (!ObjectId.isValid(reagentId) || !parsed.success || (parsed.data.minimumStock !== undefined && parsed.data.maximumStock !== undefined && parsed.data.minimumStock > parsed.data.maximumStock)) fail("validation");
  const database = await getDatabase();
  const reagentObjectId = new ObjectId(reagentId);
  const current = await database.collection<ReagentRecord>("reagents").findOne({ _id: reagentObjectId });
  if (!current) fail("missing-reagent");
  const department = await database.collection<DepartmentRecord>("departments").findOne({ _id: new ObjectId(parsed.data.departmentId), active: true, departmentKind: { $ne: "ORDER_GROUP" } });
  if (!department) fail("missing-department");
  const editable = parsed.data;
  await database.collection<ReagentRecord>("reagents").updateOne({ _id: reagentObjectId }, {
    $set: {
      name: editable.name, description: editable.description, category: editable.category as ReagentCategory,
      departmentId: department._id, manufacturer: editable.manufacturer, catalogueNumber: editable.catalogueNumber,
      unitOfIssue: editable.unitOfIssue, defaultStorageCondition: editable.defaultStorageCondition,
      minimumStock: editable.minimumStock, maximumStock: editable.maximumStock, reorderLevel: editable.reorderLevel,
      inUseStabilityDays: editable.inUseStabilityDays, updatedAt: new Date(), updatedBy: actor._id.toHexString(),
    },
  });
  await audit(actor._id, "reagent.updated", "reagent", reagentObjectId, { code: current.code });
  revalidateReagentViews(reagentId);
  redirect(`/reagents/definitions/${reagentId}?notice=updated`);
}

export async function toggleReagentActive(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:manage");
  const reagentId = field(formData, "reagentId");
  if (!ObjectId.isValid(reagentId)) fail("validation");
  const database = await getDatabase();
  const reagent = await database.collection<ReagentRecord>("reagents").findOne({ _id: new ObjectId(reagentId) });
  if (!reagent) fail("missing-reagent");
  await database.collection<ReagentRecord>("reagents").updateOne({ _id: reagent._id }, { $set: { active: !reagent.active, updatedAt: new Date(), updatedBy: actor._id.toHexString() } });
  await audit(actor._id, reagent.active ? "reagent.deactivated" : "reagent.activated", "reagent", reagent._id, { code: reagent.code });
  revalidateReagentViews(reagentId);
  redirect(`/reagents/definitions/${reagentId}?notice=${reagent.active ? "deactivated" : "activated"}`);
}

const receiveSchema = z.object({
  reagentId: z.string().regex(/^[a-f\d]{24}$/i),
  lotNumber: z.string().trim().min(1).max(100),
  batchNumber: z.string().trim().max(100).optional(),
  supplier: z.string().trim().max(120).optional(),
  quantity: z.coerce.number().positive().max(1_000_000_000),
  dateReceived: z.string(),
  expiryDate: z.string(),
  storageLocationId: z.string().regex(/^[a-f\d]{24}$/i),
  conditionOnReceipt: z.string().trim().max(300).optional(),
  remarks: z.string().trim().max(500).optional(),
});

export async function receiveReagentLot(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:receive");
  const parsed = receiveSchema.safeParse({
    reagentId: field(formData, "reagentId"), lotNumber: field(formData, "lotNumber"), batchNumber: field(formData, "batchNumber") || undefined,
    supplier: field(formData, "supplier") || undefined, quantity: field(formData, "quantity"), dateReceived: field(formData, "dateReceived"),
    expiryDate: field(formData, "expiryDate"), storageLocationId: field(formData, "storageLocationId"),
    conditionOnReceipt: field(formData, "conditionOnReceipt") || undefined, remarks: field(formData, "remarks") || undefined,
  });
  if (!parsed.success) fail("validation");
  const receivedDate = parseDateOnly(parsed.data.dateReceived);
  const expiryDate = parseDateOnly(parsed.data.expiryDate);
  if (!receivedDate || !expiryDate || expiryDate < receivedDate || receivedDate > new Date()) fail("invalid-dates");
  const database = await getDatabase();
  const reagent = await database.collection<ReagentRecord>("reagents").findOne({ _id: new ObjectId(parsed.data.reagentId), active: true });
  const location = await database.collection<ReagentStorageLocationRecord>("reagentStorageLocations").findOne({ _id: new ObjectId(parsed.data.storageLocationId), active: true });
  if (!reagent || !location) fail("invalid-reagent-or-location");
  const now = new Date();
  const lotId = new ObjectId();
  const lot: ReagentLotRecord = {
    _id: lotId, reagentId: reagent._id, lotNumber: parsed.data.lotNumber, quantityReceived: parsed.data.quantity,
    currentQuantity: parsed.data.quantity, unit: reagent.unitOfIssue, dateReceived: receivedDate, expiryDate,
    storageLocationId: location._id, status: "QUARANTINED", receivedBy: actor._id.toHexString(),
    createdAt: now, updatedAt: now,
    ...(parsed.data.batchNumber ? { batchNumber: parsed.data.batchNumber } : {}),
    ...(parsed.data.supplier ? { supplier: parsed.data.supplier } : {}),
    ...(parsed.data.conditionOnReceipt ? { conditionOnReceipt: parsed.data.conditionOnReceipt } : {}),
    ...(parsed.data.remarks ? { remarks: parsed.data.remarks } : {}),
    ...(reagent.manufacturer ? { manufacturer: reagent.manufacturer } : {}),
    ...(reagent.catalogueNumber ? { catalogueNumber: reagent.catalogueNumber } : {}),
  };
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      await database.collection<ReagentLotRecord>("reagentLots").insertOne(lot, { session });
      await database.collection<ReagentStockMovementRecord>("reagentStockMovements").insertOne({
        _id: new ObjectId(), reagentId: reagent._id, lotId, type: "RECEIPT", quantity: parsed.data.quantity,
        previousQuantity: 0, newQuantity: parsed.data.quantity, unit: reagent.unitOfIssue, reason: "Reagent received into quarantine",
        performedBy: actor._id.toHexString(), performedAt: now,
      }, { session });
      await database.collection("auditEvents").insertOne({ actorId: actor._id, action: "reagent.lot_received", recordType: "reagentLot", recordId: lotId, lotNumber: lot.lotNumber, quantity: lot.currentQuantity, status: lot.status, createdAt: now }, { session });
    });
  } catch {
    fail("duplicate-lot-or-save");
  } finally {
    await session.endSession();
  }
  revalidateReagentViews(reagent._id.toHexString(), lotId.toHexString());
  redirect(`/reagents/lots/${lotId.toHexString()}?notice=received`);
}

export async function recordLotVerification(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:verify");
  const lotId = field(formData, "lotId");
  const method = field(formData, "verificationMethod");
  const result = field(formData, "result");
  const notes = field(formData, "verificationNotes");
  if (!ObjectId.isValid(lotId) || method.length < 2 || method.length > 120 || result.length < 1 || result.length > 500 || notes.length > 1000) fail("validation");
  const database = await getDatabase();
  const lots = database.collection<ReagentLotRecord>("reagentLots");
  const lot = await lots.findOne({ _id: new ObjectId(lotId) });
  if (!lot || nextLotStatus("begin-verification", lot.status) !== "PENDING_VERIFICATION") fail("invalid-transition");
  const now = new Date();
  const verificationId = new ObjectId();
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await lots.updateOne({ _id: lot._id, status: "QUARANTINED" }, { $set: { status: "PENDING_VERIFICATION", verifiedBy: actor._id.toHexString(), verificationDate: now, updatedAt: now } }, { session });
      if (updated.modifiedCount !== 1) throw new Error("transition");
      await database.collection<ReagentVerificationRecord>("reagentVerifications").insertOne({
        _id: verificationId, reagentId: lot.reagentId, lotId: lot._id, verificationMethod: method,
        ...(notes ? { verificationNotes: notes } : {}), result, performedBy: actor._id.toHexString(), performedAt: now,
      }, { session });
      await database.collection("auditEvents").insertOne({ actorId: actor._id, action: "reagent.lot_verification_recorded", recordType: "reagentLot", recordId: lot._id, verificationId, createdAt: now }, { session });
    });
  } catch {
    fail("invalid-transition");
  } finally {
    await session.endSession();
  }
  revalidateReagentViews(lot.reagentId.toHexString(), lotId);
  redirect(`/reagents/lots/${lotId}?notice=verification-recorded`);
}

async function decideVerification(formData: FormData, decision: "APPROVED" | "REJECTED"): Promise<void> {
  const actor = await actorFor("reagents:approve");
  const lotId = field(formData, "lotId");
  const rejectionReason = field(formData, "rejectionReason");
  if (!ObjectId.isValid(lotId) || (decision === "REJECTED" && (rejectionReason.length < 3 || rejectionReason.length > 500))) fail("validation");
  const database = await getDatabase();
  const lots = database.collection<ReagentLotRecord>("reagentLots");
  const lot = await lots.findOne({ _id: new ObjectId(lotId) });
  if (!lot || nextLotStatus(decision === "APPROVED" ? "approve" : "reject", lot.status) !== decision || (decision === "APPROVED" && isLotExpired(lot))) fail("invalid-transition");
  const verification = await database.collection<ReagentVerificationRecord>("reagentVerifications").findOne({ lotId: lot._id }, { sort: { performedAt: -1 } });
  if (!verification) fail("missing-verification");
  const now = new Date();
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await lots.updateOne({ _id: lot._id, status: "PENDING_VERIFICATION" }, {
        $set: {
          status: decision, updatedAt: now,
          ...(decision === "APPROVED" ? { approvedBy: actor._id.toHexString(), approvalDate: now } : { rejectedBy: actor._id.toHexString(), rejectedAt: now, rejectionReason }),
        },
      }, { session });
      if (updated.modifiedCount !== 1) throw new Error("transition");
      await database.collection<ReagentVerificationRecord>("reagentVerifications").updateOne({ _id: verification._id }, {
        $set: { reviewedBy: actor._id.toHexString(), reviewedAt: now, decision, ...(decision === "REJECTED" ? { rejectionReason } : {}) },
      }, { session });
      await database.collection("auditEvents").insertOne({ actorId: actor._id, action: decision === "APPROVED" ? "reagent.lot_approved" : "reagent.lot_rejected", recordType: "reagentLot", recordId: lot._id, verificationId: verification._id, ...(decision === "REJECTED" ? { reason: rejectionReason } : {}), createdAt: now }, { session });
    });
  } catch {
    fail("invalid-transition");
  } finally {
    await session.endSession();
  }
  revalidateReagentViews(lot.reagentId.toHexString(), lotId);
  redirect(`/reagents/lots/${lotId}?notice=${decision.toLowerCase()}`);
}

export async function approveReagentLot(formData: FormData): Promise<void> { return decideVerification(formData, "APPROVED"); }
export async function rejectReagentLot(formData: FormData): Promise<void> { return decideVerification(formData, "REJECTED"); }

export async function openReagentLot(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:use");
  const lotId = field(formData, "lotId");
  if (!ObjectId.isValid(lotId)) fail("validation");
  const database = await getDatabase();
  const lots = database.collection<ReagentLotRecord>("reagentLots");
  const lot = await lots.findOne({ _id: new ObjectId(lotId) });
  if (!lot || !canUseLot(lot)) fail("lot-unusable");
  if (lot.status === "IN_USE") fail("already-open");
  const reagent = await database.collection<ReagentRecord>("reagents").findOne({ _id: lot.reagentId });
  const now = new Date();
  const inUseExpiryDate = reagent?.inUseStabilityDays ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + reagent.inUseStabilityDays)) : undefined;
  const update = await lots.updateOne({ _id: lot._id, status: "APPROVED", currentQuantity: { $gt: 0 }, expiryDate: { $gt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) } }, {
    $set: { status: "IN_USE", openedAt: now, openedBy: actor._id.toHexString(), updatedAt: now, ...(inUseExpiryDate ? { inUseExpiryDate } : {}) },
  });
  if (update.modifiedCount !== 1) fail("lot-unusable");
  await audit(actor._id, "reagent.lot_opened", "reagentLot", lot._id, { inUseExpiryDate });
  revalidateReagentViews(lot.reagentId.toHexString(), lotId);
  redirect(`/reagents/lots/${lotId}?notice=opened`);
}

const adjustmentSchema = z.object({ lotId: z.string().regex(/^[a-f\d]{24}$/i), direction: z.enum(["IN", "OUT"]), quantity: z.coerce.number().positive().max(1_000_000_000), reason: z.string().trim().min(3).max(300) });

export async function adjustReagentStock(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:adjust");
  const parsed = adjustmentSchema.safeParse({ lotId: field(formData, "lotId"), direction: field(formData, "direction"), quantity: field(formData, "quantity"), reason: field(formData, "reason") });
  if (!parsed.success) fail("validation");
  const database = await getDatabase();
  const lots = database.collection<ReagentLotRecord>("reagentLots");
  const lot = await lots.findOne({ _id: new ObjectId(parsed.data.lotId) });
  if (!lot || !["APPROVED", "IN_USE"].includes(lot.status) || lotEffectiveStatus(lot) === "EXPIRED") fail("lot-unusable");
  const delta = parsed.data.direction === "IN" ? parsed.data.quantity : -parsed.data.quantity;
  const movementType = delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
  const session = database.client.startSession();
  let previousQuantity = 0;
  const now = new Date();
  try {
    await session.withTransaction(async () => {
      const fresh = await lots.findOne({ _id: lot._id }, { session });
      if (!fresh || !["APPROVED", "IN_USE"].includes(fresh.status) || !canUseLot(fresh, now)) throw new Error("unusable");
      previousQuantity = fresh.currentQuantity;
      const newQuantity = previousQuantity + delta;
      const updated = await lots.updateOne({ _id: fresh._id, currentQuantity: { $gte: delta < 0 ? -delta : 0 }, status: fresh.status }, {
        $inc: { currentQuantity: delta }, $set: { updatedAt: now, ...(newQuantity === 0 ? { status: "EXHAUSTED" } : {}) },
      }, { session });
      if (updated.modifiedCount !== 1) throw new Error("stock");
      await database.collection<ReagentStockMovementRecord>("reagentStockMovements").insertOne({
        _id: new ObjectId(), reagentId: fresh.reagentId, lotId: fresh._id, type: movementType,
        quantity: delta, previousQuantity, newQuantity, unit: fresh.unit, reason: parsed.data.reason,
        performedBy: actor._id.toHexString(), performedAt: now,
      }, { session });
      await database.collection("auditEvents").insertOne({ actorId: actor._id, action: "reagent.stock_adjusted", recordType: "reagentLot", recordId: fresh._id, quantity: delta, reason: parsed.data.reason, previousQuantity, newQuantity, createdAt: now }, { session });
    });
  } catch {
    fail("stock-adjustment-failed");
  } finally {
    await session.endSession();
  }
  revalidateReagentViews(lot.reagentId.toHexString(), parsed.data.lotId);
  redirect(`/reagents/lots/${parsed.data.lotId}?notice=stock-adjusted`);
}

const useSchema = z.object({
  lotId: z.string().regex(/^[a-f\d]{24}$/i),
  quantity: z.coerce.number().positive().max(1_000_000_000),
  reason: z.string().trim().min(2).max(300),
  orderId: z.string().optional(),
  testCode: z.string().trim().max(120).optional(),
});

export async function recordReagentUsage(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:use");
  const parsed = useSchema.safeParse({ lotId: field(formData, "lotId"), quantity: field(formData, "quantity"), reason: field(formData, "reason"), orderId: field(formData, "orderId") || undefined, testCode: field(formData, "testCode") || undefined });
  if (!parsed.success || Boolean(parsed.data.orderId) !== Boolean(parsed.data.testCode)) fail("validation");
  const database = await getDatabase();
  const lot = await database.collection<ReagentLotRecord>("reagentLots").findOne({ _id: new ObjectId(parsed.data.lotId) });
  if (!lot || !canUseLot(lot)) fail("lot-unusable");
  let order: LabOrder | null = null;
  if (parsed.data.orderId) {
    if (!ObjectId.isValid(parsed.data.orderId)) fail("invalid-order");
    order = await database.collection<LabOrder>("labOrders").findOne({ _id: new ObjectId(parsed.data.orderId) });
    if (!order || !order.tests.some((item) => item.code === parsed.data.testCode)) fail("invalid-order-test");
    const requirement = await database.collection<TestReagentRequirementRecord>("testReagentRequirements").findOne({ testCode: parsed.data.testCode, reagentId: lot.reagentId });
    if (!requirement) fail("test-not-associated");
  }
  const session = database.client.startSession();
  const now = new Date();
  let previousQuantity = 0;
  try {
    await session.withTransaction(async () => {
      const fresh = await database.collection<ReagentLotRecord>("reagentLots").findOne({ _id: lot._id }, { session });
      if (!fresh || !canUseLot(fresh, now) || fresh.currentQuantity < parsed.data.quantity) throw new Error("unusable");
      if (order) {
        const currentOrder = await database.collection<LabOrder>("labOrders").findOne({ _id: order._id }, { session });
        if (!currentOrder || !currentOrder.tests.some((item) => item.code === parsed.data.testCode)) throw new Error("order-test-missing");
        const orderUpdated = await database.collection<LabOrder>("labOrders").updateOne({ _id: currentOrder._id, tests: { $elemMatch: { code: parsed.data.testCode } } }, {
          $inc: { reagentUsageCount: 1, "tests.$[test].reagentUsageCount": 1 },
          $set: { updatedAt: now },
        }, { session, arrayFilters: [{ "test.code": parsed.data.testCode }] });
        if (orderUpdated.modifiedCount !== 1) throw new Error("order-test-missing");
      }
      previousQuantity = fresh.currentQuantity;
      const newQuantity = previousQuantity - parsed.data.quantity;
      const updated = await database.collection<ReagentLotRecord>("reagentLots").updateOne({ _id: fresh._id, currentQuantity: { $gte: parsed.data.quantity }, status: fresh.status }, {
        $inc: { currentQuantity: -parsed.data.quantity }, $set: { updatedAt: now, ...(newQuantity === 0 ? { status: "EXHAUSTED" } : {}) },
      }, { session });
      if (updated.modifiedCount !== 1) throw new Error("stock");
      await database.collection<ReagentStockMovementRecord>("reagentStockMovements").insertOne({
        _id: new ObjectId(), reagentId: fresh.reagentId, lotId: fresh._id, type: "CONSUMPTION", quantity: -parsed.data.quantity,
        previousQuantity, newQuantity, unit: fresh.unit, reason: parsed.data.reason,
        ...(order ? { referenceType: "labOrderTest" as const, referenceId: order._id.toHexString(), testCode: parsed.data.testCode } : { referenceType: "manual" as const }),
        performedBy: actor._id.toHexString(), performedAt: now,
      }, { session });
      await database.collection("auditEvents").insertOne({ actorId: actor._id, action: "reagent.consumption_recorded", recordType: "reagentLot", recordId: fresh._id, quantity: -parsed.data.quantity, reason: parsed.data.reason, ...(order ? { orderId: order._id, testCode: parsed.data.testCode } : {}), previousQuantity, newQuantity, createdAt: now }, { session });
    });
  } catch {
    fail("usage-failed");
  } finally {
    await session.endSession();
  }
  revalidateReagentViews(lot.reagentId.toHexString(), parsed.data.lotId);
  if (order) revalidatePath(`/orders/${order._id.toHexString()}`);
  redirect(`/reagents/lots/${parsed.data.lotId}?notice=usage-recorded`);
}

export async function transferReagentLot(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:receive");
  const lotId = field(formData, "lotId");
  const locationId = field(formData, "storageLocationId");
  const reason = field(formData, "reason");
  if (!ObjectId.isValid(lotId) || !ObjectId.isValid(locationId) || reason.length < 2 || reason.length > 300) fail("validation");
  const database = await getDatabase();
  const lot = await database.collection<ReagentLotRecord>("reagentLots").findOne({ _id: new ObjectId(lotId) });
  const location = await database.collection<ReagentStorageLocationRecord>("reagentStorageLocations").findOne({ _id: new ObjectId(locationId), active: true });
  if (!lot || !location || lot.storageLocationId.equals(location._id) || ["DISPOSED", "REJECTED", "EXHAUSTED"].includes(lot.status)) fail("invalid-transfer");
  const now = new Date();
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await database.collection<ReagentLotRecord>("reagentLots").updateOne({ _id: lot._id, storageLocationId: lot.storageLocationId }, { $set: { storageLocationId: location._id, updatedAt: now } }, { session });
      if (updated.modifiedCount !== 1) throw new Error("concurrent-transfer");
      await database.collection<ReagentStockMovementRecord>("reagentStockMovements").insertOne({
        _id: new ObjectId(), reagentId: lot.reagentId, lotId: lot._id, type: "TRANSFER", quantity: 0,
        previousQuantity: lot.currentQuantity, newQuantity: lot.currentQuantity, unit: lot.unit, reason,
        fromLocationId: lot.storageLocationId, toLocationId: location._id, performedBy: actor._id.toHexString(), performedAt: now,
      }, { session });
      await database.collection("auditEvents").insertOne({ actorId: actor._id, action: "reagent.lot_transferred", recordType: "reagentLot", recordId: lot._id, fromLocationId: lot.storageLocationId, toLocationId: location._id, reason, createdAt: now }, { session });
    });
  } catch {
    fail("invalid-transfer");
  } finally {
    await session.endSession();
  }
  revalidateReagentViews(lot.reagentId.toHexString(), lotId);
  redirect(`/reagents/lots/${lotId}?notice=transferred`);
}

export async function disposeReagentLot(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:dispose");
  const lotId = field(formData, "lotId");
  const reason = field(formData, "reason");
  if (!ObjectId.isValid(lotId) || reason.length < 3 || reason.length > 300) fail("validation");
  const database = await getDatabase();
  const lots = database.collection<ReagentLotRecord>("reagentLots");
  const lot = await lots.findOne({ _id: new ObjectId(lotId) });
  if (!lot || nextLotStatus("dispose", lotEffectiveStatus(lot)) !== "DISPOSED") fail("invalid-transition");
  const now = new Date();
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await lots.updateOne({ _id: lot._id, status: lot.status, currentQuantity: lot.currentQuantity }, { $set: { status: "DISPOSED", currentQuantity: 0, updatedAt: now } }, { session });
      if (updated.modifiedCount !== 1) throw new Error("concurrent-disposal");
      if (lot.currentQuantity > 0) await database.collection<ReagentStockMovementRecord>("reagentStockMovements").insertOne({
        _id: new ObjectId(), reagentId: lot.reagentId, lotId: lot._id, type: "DISPOSAL", quantity: -lot.currentQuantity,
        previousQuantity: lot.currentQuantity, newQuantity: 0, unit: lot.unit, reason, performedBy: actor._id.toHexString(), performedAt: now,
      }, { session });
      await database.collection("auditEvents").insertOne({ actorId: actor._id, action: "reagent.lot_disposed", recordType: "reagentLot", recordId: lot._id, quantity: lot.currentQuantity, reason, createdAt: now }, { session });
    });
  } catch {
    fail("disposal-failed");
  } finally {
    await session.endSession();
  }
  revalidateReagentViews(lot.reagentId.toHexString(), lotId);
  redirect(`/reagents/lots/${lotId}?notice=disposed`);
}

const requirementSchema = z.object({
  testCode: z.string().trim().min(1).max(120), reagentId: z.string().regex(/^[a-f\d]{24}$/i),
  role: z.enum(["REAGENT", "CALIBRATOR", "CONTROL", "OTHER"]), quantityPerTest: z.coerce.number().positive().optional(),
  unit: z.string().trim().max(40).optional(), required: z.boolean(),
});

export async function createTestReagentRequirement(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:manage");
  const parsed = requirementSchema.safeParse({
    testCode: field(formData, "testCode"), reagentId: field(formData, "reagentId"), role: field(formData, "role"),
    quantityPerTest: field(formData, "quantityPerTest") || undefined, unit: field(formData, "unit") || undefined, required: field(formData, "required") === "on",
  });
  if (!parsed.success) fail("validation");
  const database = await getDatabase();
  const [definition, reagent] = await Promise.all([
    database.collection<{ code: string; panelHeaderOnly?: boolean }>("testDefinitions").findOne({ code: parsed.data.testCode }),
    database.collection<ReagentRecord>("reagents").findOne({ _id: new ObjectId(parsed.data.reagentId), active: true }),
  ]);
  if (!definition || definition.panelHeaderOnly || !reagent) fail("missing-requirement-target");
  const now = new Date();
  const requirement: TestReagentRequirementRecord = {
    _id: new ObjectId(), testCode: parsed.data.testCode, reagentId: reagent._id, role: parsed.data.role,
    ...(parsed.data.quantityPerTest ? { quantityPerTest: parsed.data.quantityPerTest } : {}),
    ...(parsed.data.unit ? { unit: parsed.data.unit } : {}), required: parsed.data.required,
    createdAt: now, updatedAt: now, createdBy: actor._id.toHexString(),
  };
  try {
    await database.collection<TestReagentRequirementRecord>("testReagentRequirements").insertOne(requirement);
  } catch {
    fail("duplicate-requirement");
  }
  await audit(actor._id, "reagent.test_requirement_created", "testReagentRequirement", requirement._id, { testCode: requirement.testCode, reagentId: reagent._id, role: requirement.role });
  revalidateReagentViews(reagent._id.toHexString());
  redirect("/reagents/settings?notice=requirement-created");
}

export async function deleteTestReagentRequirement(formData: FormData): Promise<void> {
  const actor = await actorFor("reagents:manage");
  const requirementId = field(formData, "requirementId");
  if (!ObjectId.isValid(requirementId)) fail("validation");
  const database = await getDatabase();
  const requirements = database.collection<TestReagentRequirementRecord>("testReagentRequirements");
  const requirement = await requirements.findOne({ _id: new ObjectId(requirementId) });
  if (!requirement) fail("missing-requirement");
  const used = await database.collection<ReagentStockMovementRecord>("reagentStockMovements").findOne({ testCode: requirement.testCode, reagentId: requirement.reagentId });
  if (used) fail("requirement-has-history");
  await requirements.deleteOne({ _id: requirement._id });
  await audit(actor._id, "reagent.test_requirement_removed", "testReagentRequirement", requirement._id, { testCode: requirement.testCode, reagentId: requirement.reagentId });
  revalidateReagentViews(requirement.reagentId.toHexString());
  redirect("/reagents/settings?notice=requirement-removed");
}
