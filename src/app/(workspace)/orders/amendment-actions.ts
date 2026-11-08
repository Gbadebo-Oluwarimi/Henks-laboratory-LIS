"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDatabase } from "@/lib/mongodb";
import type { LabOrder } from "@/lib/models";
import { canAuthorizeReports, requireUser } from "@/lib/session";

function text(data: FormData, key: string): string {
  const item = data.get(key);
  return typeof item === "string" ? item.trim() : "";
}

const schema = z.object({
  orderId: z.string().trim().min(1),
  testCode: z.string().trim().min(1).max(100),
  result: z.string().trim().max(3000),
  reason: z.string().trim().min(3).max(500),
});

export async function beginReportAmendment(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!canAuthorizeReports(actor)) redirect("/dashboard?error=forbidden");
  const parsed = schema.safeParse({ orderId: text(formData, "orderId"), testCode: text(formData, "testCode"), result: text(formData, "result"), reason: text(formData, "reason") });
  if (!parsed.success || !ObjectId.isValid(parsed.data.orderId)) {
    const orderId = text(formData, "orderId");
    if (ObjectId.isValid(orderId) && text(formData, "result").length > 3000) redirect(`/orders/${orderId}?error=result-validation`);
    redirect("/reports?error=validation");
  }

  const database = await getDatabase();
  const orders = database.collection<LabOrder>("labOrders");
  const orderId = new ObjectId(parsed.data.orderId);
  const order = await orders.findOne({ _id: orderId });
  if (!order || !order.authorizedAt || !order.authorizedBy || !order.authorizedByName) redirect(`/orders/${parsed.data.orderId}?error=amendment-unavailable`);
  const test = order.tests.find((item) => item.code === parsed.data.testCode && item.status === "Completed");
  if (!test) redirect(`/orders/${parsed.data.orderId}?error=transition`);

  const now = new Date();
  const priorVersions = order.reportVersions?.length ? order.reportVersions : [{
    version: 1,
    accessionId: order.accessionId,
    releasedAt: order.authorizedAt,
    releasedBy: order.authorizedBy,
    releasedByName: order.authorizedByName,
    releasedByRole: order.authorizedByRole,
    patientSnapshot: order.clientSnapshot,
    tests: order.tests,
  }];
  const updated = await orders.updateOne(
    { _id: orderId, updatedAt: order.updatedAt, authorizedAt: order.authorizedAt, tests: { $elemMatch: { code: test.code, status: "Completed" } } },
    {
      $set: {
        "tests.$[item].result": parsed.data.result,
        "tests.$[item].status": "In Progress",
        "tests.$[item].updatedAt": now,
        "tests.$[item].updatedBy": actor._id.toHexString(),
        "tests.$[item].reviewedAt": null,
        "tests.$[item].reviewedBy": null,
        status: "In Progress",
        updatedAt: now,
        reportVersions: priorVersions,
        pendingAmendment: { reason: parsed.data.reason, startedAt: now, startedBy: actor._id.toHexString() },
      },
      $unset: {
        authorizedBy: "", authorizedByName: "", authorizedByEmail: "", authorizedByRole: "", authorizedAt: "",
        "tests.$[item].resultValue": "",
      },
    },
    { arrayFilters: [{ "item.code": test.code, "item.status": "Completed" }] },
  );
  if (updated.modifiedCount !== 1) redirect(`/orders/${parsed.data.orderId}?error=transition`);
  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: "report.amendment_started",
    recordType: "labOrder",
    recordId: orderId,
    accessionId: order.accessionId,
    testCode: test.code,
    changedFields: ["result"],
    fromVersion: priorVersions.at(-1)?.version,
    reason: parsed.data.reason,
    createdAt: now,
  });
  revalidatePath(`/orders/${parsed.data.orderId}`);
  revalidatePath(`/reports/${parsed.data.orderId}`);
  revalidatePath("/reports");
  redirect(`/orders/${parsed.data.orderId}?notice=amendment-started`);
}
