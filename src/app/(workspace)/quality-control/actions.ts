"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDatabase } from "@/lib/mongodb";
import type { QualityControlConfigRecord, QualityControlRunRecord } from "@/lib/models";
import { evaluateNumericQc } from "@/lib/quality-control";
import { requireUser } from "@/lib/session";

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const configSchema = z.object({
  testCode: z.string().trim().min(1).max(100),
  controlName: z.string().trim().min(1).max(120),
  controlLevel: z.string().trim().min(1).max(80),
  lotNumber: z.string().trim().min(1).max(100),
  expiresAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  unit: z.string().trim().max(40),
  minimumAccepted: z.coerce.number().finite(),
  maximumAccepted: z.coerce.number().finite(),
  instrument: z.string().trim().max(120).optional(),
  method: z.string().trim().max(120).optional(),
  requiresPassedQc: z.boolean(),
});

export async function createQualityControlConfig(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.role !== "Administrator") redirect("/quality-control?error=forbidden");
  const parsed = configSchema.safeParse({
    testCode: text(formData, "testCode"), controlName: text(formData, "controlName"), controlLevel: text(formData, "controlLevel"),
    lotNumber: text(formData, "lotNumber"), expiresAt: text(formData, "expiresAt"), unit: text(formData, "unit"),
    minimumAccepted: text(formData, "minimumAccepted"), maximumAccepted: text(formData, "maximumAccepted"),
    instrument: text(formData, "instrument") || undefined, method: text(formData, "method") || undefined,
    requiresPassedQc: formData.get("requiresPassedQc") === "on",
  });
  if (!parsed.success || parsed.data.minimumAccepted > parsed.data.maximumAccepted) redirect("/quality-control?error=config-validation");
  const expiresAt = new Date(`${parsed.data.expiresAt}T23:59:59.999Z`);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.toISOString().slice(0, 10) !== parsed.data.expiresAt) redirect("/quality-control?error=config-validation");
  const database = await getDatabase();
  const definition = await database.collection<{ code: string; name: string; kind?: string }>("testDefinitions").findOne({ code: parsed.data.testCode });
  if (!definition) redirect("/quality-control?error=unknown-test");
  if (definition.kind !== "numeric") redirect("/quality-control?error=unsupported-test");
  const now = new Date();
  const config: QualityControlConfigRecord = {
    _id: new ObjectId(), testCode: definition.code, testName: definition.name,
    controlName: parsed.data.controlName, controlLevel: parsed.data.controlLevel, lotNumber: parsed.data.lotNumber,
    expiresAt, unit: parsed.data.unit, minimumAccepted: parsed.data.minimumAccepted, maximumAccepted: parsed.data.maximumAccepted,
    ...(parsed.data.instrument ? { instrument: parsed.data.instrument } : {}), ...(parsed.data.method ? { method: parsed.data.method } : {}),
    requiresPassedQc: parsed.data.requiresPassedQc, active: true, createdAt: now, createdBy: actor._id, updatedAt: now,
  };
  await database.collection<QualityControlConfigRecord>("qualityControlConfigs").insertOne(config);
  await database.collection("auditEvents").insertOne({ actorId: actor._id, action: "qc.configuration_created", recordType: "qualityControlConfig", recordId: config._id, testCode: config.testCode, controlName: config.controlName, controlLevel: config.controlLevel, lotNumber: config.lotNumber, createdAt: now });
  revalidatePath("/quality-control");
  redirect("/quality-control?notice=configured");
}

export async function recordQualityControlRun(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.role !== "Administrator" && actor.role !== "Laboratory Staff") redirect("/quality-control?error=forbidden");
  const configId = text(formData, "configId");
  const observed = z.coerce.number().finite().safeParse(text(formData, "observedValue"));
  if (!ObjectId.isValid(configId) || !observed.success) redirect("/quality-control?error=run-validation");
  const database = await getDatabase();
  const config = await database.collection<QualityControlConfigRecord>("qualityControlConfigs").findOne({ _id: new ObjectId(configId), active: true });
  if (!config) redirect("/quality-control?error=missing-config");
  const now = new Date();
  const status = evaluateNumericQc(observed.data, config.minimumAccepted, config.maximumAccepted, config.expiresAt, now);
  const run: QualityControlRunRecord = {
    _id: new ObjectId(), configId: config._id, testCode: config.testCode, testName: config.testName,
    controlName: config.controlName, controlLevel: config.controlLevel, lotNumber: config.lotNumber,
    observedValue: observed.data, unit: config.unit, minimumAccepted: config.minimumAccepted, maximumAccepted: config.maximumAccepted,
    expiresAt: config.expiresAt, ...(config.instrument ? { instrument: config.instrument } : {}), ...(config.method ? { method: config.method } : {}),
    status, runAt: now, operatorId: actor._id,
    ...(text(formData, "comments") ? { comments: text(formData, "comments").slice(0, 1000) } : {}),
    events: [{ action: "RUN_RECORDED", actorId: actor._id, occurredAt: now }],
  };
  await database.collection<QualityControlRunRecord>("qualityControlRuns").insertOne(run);
  await database.collection("auditEvents").insertOne({ actorId: actor._id, action: `qc.run_${status.toLowerCase()}`, recordType: "qualityControlRun", recordId: run._id, testCode: run.testCode, observedValue: run.observedValue, status, configId: config._id, createdAt: now });
  revalidatePath("/quality-control");
  redirect(`/quality-control?notice=run-${status.toLowerCase()}`);
}

export async function recordQualityControlCorrectiveAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.role !== "Administrator" && actor.role !== "Laboratory Staff") redirect("/quality-control?error=forbidden");
  const runId = text(formData, "runId");
  const notes = z.string().trim().min(3).max(1000).safeParse(text(formData, "notes"));
  if (!ObjectId.isValid(runId) || !notes.success) redirect("/quality-control?error=action-validation");
  const database = await getDatabase();
  const run = await database.collection<QualityControlRunRecord>("qualityControlRuns").findOne({ _id: new ObjectId(runId), status: { $in: ["FAIL", "INVALID"] } });
  if (!run) redirect("/quality-control?error=missing-run");
  const now = new Date();
  const event = { action: "CORRECTIVE_ACTION" as const, actorId: actor._id, occurredAt: now, notes: notes.data };
  const updated = await database.collection<QualityControlRunRecord>("qualityControlRuns").updateOne({ _id: run._id }, { $push: { events: event } });
  if (updated.modifiedCount !== 1) redirect("/quality-control?error=missing-run");
  await database.collection("auditEvents").insertOne({ actorId: actor._id, action: "qc.corrective_action_recorded", recordType: "qualityControlRun", recordId: run._id, testCode: run.testCode, status: run.status, createdAt: now });
  revalidatePath("/quality-control");
  redirect("/quality-control?notice=action-recorded");
}

export async function deactivateQualityControlConfig(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.role !== "Administrator") redirect("/quality-control?error=forbidden");
  const configId = text(formData, "configId");
  const reason = z.string().trim().min(3).max(300).safeParse(text(formData, "reason"));
  if (!ObjectId.isValid(configId) || !reason.success) redirect("/quality-control?error=config-retire-validation");
  const database = await getDatabase();
  const configs = database.collection<QualityControlConfigRecord>("qualityControlConfigs");
  const config = await configs.findOne({ _id: new ObjectId(configId), active: true });
  if (!config) redirect("/quality-control?error=missing-config");
  if (config.requiresPassedQc) {
    const replacement = await configs.findOne({ _id: { $ne: config._id }, testCode: config.testCode, active: true, requiresPassedQc: true });
    if (!replacement) redirect("/quality-control?error=gate-replacement-required");
  }
  const now = new Date();
  const updated = await configs.updateOne({ _id: config._id, active: true }, { $set: { active: false, updatedAt: now } });
  if (updated.modifiedCount !== 1) redirect("/quality-control?error=missing-config");
  await database.collection("auditEvents").insertOne({ actorId: actor._id, action: "qc.configuration_deactivated", recordType: "qualityControlConfig", recordId: config._id, testCode: config.testCode, controlName: config.controlName, lotNumber: config.lotNumber, reason: reason.data, createdAt: now });
  revalidatePath("/quality-control");
  redirect("/quality-control?notice=config-retired");
}
