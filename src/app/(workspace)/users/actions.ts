"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";

import { getDatabase } from "@/lib/mongodb";
import { requireUser } from "@/lib/session";
import type { UserPermission, UserRecord } from "@/lib/models";

const reagentPermissions: UserPermission[] = [
  "reagents:view", "reagents:manage", "reagents:receive", "reagents:verify", "reagents:approve", "reagents:use", "reagents:adjust", "reagents:dispose",
];

export async function updateUserReagentPermissions(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const userId = String(formData.get("userId") ?? "").trim();
  if (!ObjectId.isValid(userId) || actor._id.toHexString() === userId) redirect("/users?error=invalid");

  const selected = formData.getAll("reagentPermissions").filter((item): item is string => typeof item === "string");
  if (selected.some((permission) => !reagentPermissions.includes(permission as UserPermission))) redirect("/users?error=invalid-permissions");

  const database = await getDatabase();
  const users = database.collection<UserRecord>("users");
  const target = await users.findOne({ _id: new ObjectId(userId) });
  if (!target || target.role === "Administrator") redirect("/users?error=missing");
  const retainedPermissions = (target.permissions ?? []).filter((permission) => !reagentPermissions.includes(permission));
  const permissions = [...new Set([...retainedPermissions, ...selected as UserPermission[]])];
  await users.updateOne({ _id: target._id }, { $set: { permissions } });
  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: "user.reagent_permissions_updated",
    recordType: "user",
    recordId: target._id,
    permissions: selected,
    createdAt: new Date(),
  });
  revalidatePath("/users");
  revalidatePath("/reagents");
  redirect("/users?notice=reagent-permissions-updated");
}

export async function deleteUser(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const userId = String(formData.get("userId") ?? "").trim();
  if (!ObjectId.isValid(userId) || actor._id.toHexString() === userId) redirect("/users?error=invalid");

  const database = await getDatabase();
  const users = database.collection<UserRecord>("users");
  const target = await users.findOne({ _id: new ObjectId(userId) });
  if (!target) redirect("/users?error=missing");

  if (target.role === "Administrator" && target.active !== false &&
      await users.countDocuments({ role: "Administrator", active: true }) <= 1) {
    redirect("/users?error=last-active-admin");
  }

  const result = await users.deleteOne({ _id: target._id });
  if (!result.deletedCount) redirect("/users?error=missing");
  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: "user.deleted",
    recordType: "user",
    recordId: target._id,
    userName: target.name,
    userEmail: target.email,
    userRole: target.role,
    createdAt: new Date(),
  });
  revalidatePath("/users");
  revalidatePath("/reports");
  redirect("/users?notice=deleted");
}
