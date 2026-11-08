"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDatabase } from "@/lib/mongodb";
import type { SpecimenRecord } from "@/lib/models";
import { requireUser } from "@/lib/session";
import { canTransitionSpecimen } from "@/lib/specimens";

const schema = z.object({
  specimenId: z.string().trim().min(1).max(80),
  toStatus: z.enum(["COLLECTED", "RECEIVED", "ACCEPTED", "IN_PROCESS", "COMPLETED", "REJECTED", "RECOLLECTION_REQUIRED", "CANCELLED"]),
  reason: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function transitionSpecimen(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== "Administrator" && user.role !== "Laboratory Staff") redirect("/specimens?error=forbidden");

  const parsed = schema.safeParse({
    specimenId: formData.get("specimenId"),
    toStatus: formData.get("toStatus"),
    reason: formData.get("reason") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success || (parsed.data.toStatus === "REJECTED" && !parsed.data.reason)) redirect("/specimens?error=validation");

  const database = await getDatabase();
  const specimens = database.collection<SpecimenRecord>("specimens");
  const specimen = await specimens.findOne({ specimenId: parsed.data.specimenId });
  if (!specimen) redirect("/specimens?error=missing");
  if (!canTransitionSpecimen(specimen.status, parsed.data.toStatus)) redirect("/specimens?error=transition");

  const now = new Date();
  const event = {
    action: parsed.data.toStatus,
    fromStatus: specimen.status,
    toStatus: parsed.data.toStatus,
    actorId: user._id,
    occurredAt: now,
    ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
    ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
  };
  const set: Record<string, unknown> = { status: parsed.data.toStatus, updatedAt: now };
  if (parsed.data.toStatus === "COLLECTED") Object.assign(set, { collectedAt: now, collectedBy: user._id });
  if (parsed.data.toStatus === "RECEIVED") Object.assign(set, { receivedAt: now, receivedBy: user._id });
  if (parsed.data.toStatus === "REJECTED") set.rejectionReason = parsed.data.reason;
  let recollection: SpecimenRecord | undefined;
  if (parsed.data.toStatus === "RECOLLECTION_REQUIRED") {
    recollection = {
      _id: new ObjectId(),
      specimenId: `SP-${now.toISOString().slice(2, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`,
      patientId: specimen.patientId,
      patientName: specimen.patientName,
      patientNumber: specimen.patientNumber,
      orderId: specimen.orderId,
      parentSpecimenId: specimen._id,
      accessionId: specimen.accessionId,
      testCodes: specimen.testCodes,
      specimenType: specimen.specimenType,
      status: "ORDERED",
      createdAt: now,
      updatedAt: now,
      events: [{ action: "ORDERED", toStatus: "ORDERED", actorId: user._id, occurredAt: now, ...(parsed.data.reason ? { reason: parsed.data.reason } : {}) }],
    };
    await specimens.insertOne(recollection);
  }
  const changed = await specimens.updateOne(
    { _id: specimen._id, status: specimen.status },
    { $set: set, $push: { events: event } },
  );
  if (changed.modifiedCount !== 1) {
    if (recollection) await specimens.deleteOne({ _id: recollection._id });
    redirect("/specimens?error=transition");
  }
  if (recollection) {
    await database.collection("labOrders").updateOne({ _id: specimen.orderId }, { $addToSet: { specimenIds: recollection._id }, $set: { updatedAt: now } });
    await database.collection("auditEvents").insertOne({ actorId: user._id, action: "specimen.recollection_ordered", recordType: "specimen", recordId: recollection._id, specimenId: recollection.specimenId, parentSpecimenId: specimen._id, orderId: specimen.orderId, reason: parsed.data.reason, createdAt: now });
  }

  await database.collection("auditEvents").insertOne({
    actorId: user._id,
    action: `specimen.${parsed.data.toStatus.toLowerCase()}`,
    recordType: "specimen",
    recordId: specimen._id,
    specimenId: specimen.specimenId,
    orderId: specimen.orderId,
    fromStatus: specimen.status,
    toStatus: parsed.data.toStatus,
    reason: parsed.data.reason,
    createdAt: now,
  });
  revalidatePath("/specimens");
  revalidatePath(`/orders/${specimen.orderId.toHexString()}`);
  redirect("/specimens?notice=updated");
}
