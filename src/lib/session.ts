import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDatabase, ConfigurationError } from "@/lib/mongodb";
import type { UserPermission, UserRecord, UserRole } from "@/lib/models";

const cookieName = "lis_session";
const sessionDurationSeconds = 60 * 60 * 8;

type SessionPayload = { userId: string; expiresAt: number };

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new ConfigurationError("Set AUTH_SECRET to a random value of at least 32 characters.");
  }
  return value;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(userId: ObjectId): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationSeconds;
  const payload = Buffer.from(JSON.stringify({ userId: userId.toHexString(), expiresAt })).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(cookieName, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionDurationSeconds,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(cookieName);
}

async function readSession(): Promise<SessionPayload | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  const [payload, receivedSignature] = value.split(".");
  if (!payload || !receivedSignature) return null;

  let expectedSignature: string;
  try {
    expectedSignature = signature(payload);
  } catch {
    return null;
  }

  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!ObjectId.isValid(decoded.userId) || decoded.expiresAt <= Date.now() / 1000) return null;
    return decoded;
  } catch {
    return null;
  }
}

export type SessionUser = Pick<UserRecord, "_id" | "name" | "email" | "role" | "canAuthorizeReports" | "permissions">;

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await readSession();
  if (!session) return null;
  const database = await getDatabase();
  const user = await database.collection<UserRecord>("users").findOne(
    { _id: new ObjectId(session.userId), active: true },
    { projection: { name: 1, email: 1, role: 1, canAuthorizeReports: 1, permissions: 1 } },
  );
  return user ? { _id: user._id, name: user.name, email: user.email, role: user.role, canAuthorizeReports: user.canAuthorizeReports, permissions: user.permissions } : null;
}

export function hasPermission(user: Pick<UserRecord, "role" | "permissions"> | null | undefined, permission: UserPermission): boolean {
  if (user?.role === "Administrator") return true;
  if (permission === "reagents:view" && user?.permissions?.some((item) => item.startsWith("reagents:"))) return true;
  return user?.permissions?.includes(permission) === true;
}

export async function requirePermission(permission: UserPermission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) redirect("/dashboard?error=forbidden");
  return user;
}

export function canAuthorizeReports(user: Pick<UserRecord, "role" | "canAuthorizeReports"> | null | undefined): boolean {
  return user?.role === "Administrator" || user?.canAuthorizeReports === true;
}

export async function requireUser(allowedRoles?: UserRole[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (allowedRoles && !allowedRoles.includes(user.role)) redirect("/dashboard");
  return user;
}
