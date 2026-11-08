"use server";



import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";

import { ObjectId, type Db, type Filter } from "mongodb";

import { z } from "zod";

import { getDatabase } from "@/lib/mongodb";

import { hashPassword, verifyPassword } from "@/lib/password";

import { canAuthorizeReports, clearSession, createSession, requireUser } from "@/lib/session";

import type { CataloguePriceRecord, ClientRecord, DepartmentRecord, LabOrder, LabReportDetails, OrderedTest, SpecimenRecord, UserRecord } from "@/lib/models";
import type { CatalogueTest } from "@/lib/catalogue";
import { displayPanelName } from "@/lib/catalogue";

import { nextTestStatus, overallOrderStatus, type TestAction, type TestStatus } from "@/lib/workflow";
import { testsBlockedByQualityControl } from "@/lib/quality-control";
import { buildReleasedReportVersion } from "@/lib/reporting";
import { syncOpenOrdersForPanel, syncOpenOrdersForPanels } from "@/lib/catalogue-sync";



const emailSchema = z.string().trim().email().max(254);

const reportDetailsSchema = z.object({
  surname: z.string().trim().max(120),
  otherNames: z.string().trim().max(120),
  laboratoryNo: z.string().trim().min(1).max(80),
  hospitalNo: z.string().trim().max(80),
  age: z.string().trim().max(12),
  ageUnit: z.enum(["days", "months", "years"]),
  sex: z.enum(["Female", "Male", "Other", ""]),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestedTest: z.string().trim().max(1000),
  specimen: z.string().trim().max(160),
  generalComment: z.string().trim().max(2000),
  filmReport: z.string().trim().max(3000),
  filmRBCs: z.string().trim().max(1000),
  filmWBCs: z.string().trim().max(1000),
  filmPlatelets: z.string().trim().max(1000),
  filmMalaria: z.string().trim().max(1000),
});

async function testsWithRejectedSpecimens(database: Db, orderId: ObjectId, testCodes: string[]): Promise<Set<string>> {
  if (!testCodes.length) return new Set();
  const specimens = await database.collection<SpecimenRecord>("specimens")
    .find({ orderId, status: "REJECTED", testCodes: { $in: testCodes } }, { projection: { testCodes: 1 } })
    .toArray();
  const requested = new Set(testCodes);
  return new Set(specimens.flatMap((specimen) => specimen.testCodes.filter((code) => requested.has(code))));
}

const clientSchema = z.object({

  fullName: z.string().trim().min(2).max(120),

  dateOfBirth: z.string().trim().max(10).optional(),

  sex: z.enum(["Female", "Male", "Other"]).optional(),

  phone: z.string().trim().max(40).optional(),

  email: z.string().trim().email().max(254).optional(),

  address: z.string().trim().max(300).optional(),

});

function normalizedPatientName(input: string): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}



function value(formData: FormData, key: string): string {

  const field = formData.get(key);

return typeof field === "string" ? field.trim() : "";

}



function safeError(path: string, code: string): never {

  redirect(`${path}?error=${encodeURIComponent(code)}`);

}

function logSignInFailure(stage: "database" | "session", error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  // MongoDB driver errors can include a connection string. Keep credentials out
  // of Vercel logs while retaining the useful error and configuration context.
  const sanitizedMessage = message.replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, "[MongoDB URI redacted]");
  console.error("Sign-in configuration failure", {
    stage,
    errorName: error instanceof Error ? error.name : "UnknownError",
    message: sanitizedMessage,
    mongodbUriConfigured: Boolean(process.env.MONGODB_URI),
    authSecretConfigured: Boolean(process.env.AUTH_SECRET),
    authSecretMeetsMinimumLength: (process.env.AUTH_SECRET?.length ?? 0) >= 32,
  });
}

const firstAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: z.string().min(14).max(256),
});

export async function signUpFirstAdmin(formData: FormData): Promise<void> {
  const parsed = firstAdminSchema.safeParse({
    name: value(formData, "name"),
    email: value(formData, "email").toLowerCase(),
    password: value(formData, "password"),
  });
  if (!parsed.success) safeError("/sign-up", "validation");

  const database = await getDatabase();
  const users = database.collection<UserRecord>("users");
  const bootstrapLocks = database.collection<{ _id: string; userId: ObjectId }>("systemLocks");
  let existingLock = await bootstrapLocks.findOne({ _id: "initial-admin" });

  if (existingLock) {
    const pending = await users.findOne({
      _id: existingLock.userId,
      email: parsed.data.email,
      bootstrapAdmin: true,
      active: false,
    });
    if (pending) {
      await users.updateOne(
        { _id: pending._id, active: false },
        {
          $set: { active: true },
          $unset: { verificationTokenHash: "", verificationExpiresAt: "", emailVerified: "" },
        },
      );
      redirect("/sign-in?notice=account-created");
    }

    // A process can stop after claiming the bootstrap lock but before inserting
    // the user. Reclaim that orphaned lock when no user exists so first setup
    // does not remain permanently closed.
    if (await users.countDocuments({}) !== 0) safeError("/sign-up", "closed");
    await bootstrapLocks.deleteOne({ _id: "initial-admin", userId: existingLock.userId });
    existingLock = null;
  }

  if (await users.countDocuments({}) !== 0) safeError("/sign-up", "closed");

  const userId = new ObjectId();
  try {
    await bootstrapLocks.insertOne({ _id: "initial-admin", userId });
  } catch {
    safeError("/sign-up", "closed");
  }

  try {
    await users.insertOne({
      _id: userId,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "Administrator",
      active: true,
      bootstrapAdmin: true,
    });
  } catch {
    await bootstrapLocks.deleteOne({ _id: "initial-admin", userId });
    safeError("/sign-up", "save");
  }

  redirect("/sign-in?notice=account-created");
}



export async function signIn(formData: FormData): Promise<void> {

  const parsedEmail = emailSchema.safeParse(value(formData, "email").toLowerCase());

  const password = value(formData, "password");

if (!parsedEmail.success || !password || password.length > 256) safeError("/sign-in", "credentials");



  let user: UserRecord | null;

try {

    const database = await getDatabase();

    user = await database.collection<UserRecord>("users").findOne({

      email: parsedEmail.data,

      active: true,

    });

  } catch (error) {

    logSignInFailure("database", error);

    safeError("/sign-in", "configuration");

  }



  const valid = user ? await verifyPassword(password, user.passwordHash) : false;

if (!user || !valid) safeError("/sign-in", "credentials");

try {

await createSession(user._id);

  } catch (error) {

    logSignInFailure("session", error);

    safeError("/sign-in", "configuration");

  }

  redirect("/dashboard");

}



export async function signOut(): Promise<void> {

await clearSession();

  redirect("/sign-in");

}

const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: z.string().min(14).max(256),
  role: z.enum(["Administrator", "Reception", "Laboratory Staff"]),
  canAuthorizeReports: z.boolean(),
});

export async function createUser(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const parsed = userSchema.safeParse({
    name: value(formData, "name"),
    email: value(formData, "email").toLowerCase(),
    password: value(formData, "password"),
    role: value(formData, "role"),
    canAuthorizeReports: value(formData, "canAuthorizeReports") === "on",
  });
  if (!parsed.success) safeError("/users", "validation");

  const database = await getDatabase();
  const users = database.collection<UserRecord>("users");
  await users.createIndex({ email: 1 }, { unique: true });
  if (await users.findOne({ email: parsed.data.email }, { projection: { _id: 1 } })) {
    safeError("/users", "duplicate");
  }
  try {
    await users.insertOne({
      _id: new ObjectId(),
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      canAuthorizeReports: parsed.data.canAuthorizeReports,
      active: true,
    });
  } catch {
    safeError("/users", "save");
  }
  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: "user.created",
    email: parsed.data.email,
    role: parsed.data.role,
    createdAt: new Date(),
  });
  revalidatePath("/users");
  redirect("/users?notice=created");
}

export async function toggleUserActive(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const userId = value(formData, "userId");
  if (!ObjectId.isValid(userId) || actor._id.toHexString() === userId) safeError("/users", "invalid");
  const database = await getDatabase();
  const users = database.collection<UserRecord>("users");
  const target = await users.findOne({ _id: new ObjectId(userId) });
  if (!target) safeError("/users", "missing");
  await users.updateOne({ _id: target._id }, { $set: { active: target.active === false } });
  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: target.active === false ? "user.activated" : "user.deactivated",
    recordType: "user",
    recordId: target._id,
    createdAt: new Date(),
  });
  revalidatePath("/users");
  redirect("/users?notice=updated");
}

export async function toggleUserReportApproval(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const userId = value(formData, "userId");
  if (!ObjectId.isValid(userId) || actor._id.toHexString() === userId) safeError("/users", "invalid");
  const database = await getDatabase();
  const users = database.collection<UserRecord>("users");
  const target = await users.findOne({ _id: new ObjectId(userId) });
  if (!target) safeError("/users", "missing");
  const canAuthorizeReports = target.canAuthorizeReports !== true;
  await users.updateOne({ _id: target._id }, { $set: { canAuthorizeReports } });
  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: canAuthorizeReports ? "user.report_approval_enabled" : "user.report_approval_disabled",
    recordType: "user",
    recordId: target._id,
    createdAt: new Date(),
  });
  revalidatePath("/users");
  redirect("/users?notice=permission-updated");
}

const catalogueTestSchema = z.object({
  panel: z.string().trim().min(1).max(120),
  subcategory: z.string().trim().max(120).optional(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["numeric", "qualitative", "narrative"]),
  unit: z.string().trim().max(40),
  sourceReference: z.string().trim().max(240),
  specimenType: z.string().trim().max(120).optional(),
  departmentCode: z.string().trim().max(40).optional(),
  sourceContainer: z.string().trim().max(160).optional(),
  sourceMethod: z.string().trim().max(160).optional(),
  sourceAvailability: z.enum(["IN_HOUSE", "REFERRAL", "UNAVAILABLE", ""]).optional(),
  referenceApproved: z.boolean(),
});

function catalogueSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "test";
}

function readCatalogueTest(formData: FormData) {
  return catalogueTestSchema.safeParse({
    panel: value(formData, "panel"),
    subcategory: value(formData, "subcategory") || undefined,
    name: value(formData, "name"),
    kind: value(formData, "kind"),
    unit: value(formData, "unit"),
    sourceReference: value(formData, "sourceReference"),
    specimenType: value(formData, "specimenType") || undefined,
    departmentCode: value(formData, "departmentCode") || undefined,
    sourceContainer: value(formData, "sourceContainer") || undefined,
    sourceMethod: value(formData, "sourceMethod") || undefined,
    sourceAvailability: value(formData, "sourceAvailability") as "IN_HOUSE" | "REFERRAL" | "UNAVAILABLE" | "",
    referenceApproved: formData.get("referenceApproved") === "on",
  });
}

export async function createCatalogueTest(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const parsed = readCatalogueTest(formData);
  if (!parsed.success) safeError("/catalogue", "validation");

  const database = await getDatabase();
  if (parsed.data.departmentCode && !await database.collection("departments").findOne({ code: parsed.data.departmentCode, active: true, departmentKind: { $ne: "ORDER_GROUP" } })) safeError("/catalogue", "invalid-department");
  const definitions = database.collection<CatalogueTest & { enabled: boolean; createdAt?: Date }>("testDefinitions");
  const panelDefinitions = await definitions.find({ panel: parsed.data.panel }, { projection: { departmentCode: 1 } }).toArray();
  const panelDepartmentCodes = [...new Set(panelDefinitions.map((definition) => definition.departmentCode ?? ""))];
  if (panelDepartmentCodes.length > 1) safeError("/catalogue", "panel-department-mismatch");
  const currentPanelDepartment = panelDepartmentCodes[0] || "";
  if (currentPanelDepartment && parsed.data.departmentCode && currentPanelDepartment !== parsed.data.departmentCode) safeError("/catalogue", "panel-department-mismatch");
  const departmentCode = currentPanelDepartment || parsed.data.departmentCode;
  if (!departmentCode) safeError("/catalogue", "panel-department-required");
  const duplicate = await definitions.findOne({
    panel: parsed.data.panel,
    name: { $regex: `^${parsed.data.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (duplicate) safeError("/catalogue", "duplicate-test");

  if (panelDefinitions.length > 0 && !currentPanelDepartment) await definitions.updateMany({ panel: parsed.data.panel }, { $set: { departmentCode, updatedAt: new Date() } });

  const code = `${catalogueSlug(parsed.data.panel)}:${catalogueSlug(parsed.data.name)}-${randomBytes(3).toString("hex")}`;
  const testData = { ...parsed.data, departmentCode };
  const { sourceContainer, sourceMethod, sourceAvailability, referenceApproved, departmentCode: resolvedDepartmentCode, subcategory, ...catalogueData } = testData;
  await definitions.insertOne({
    code,
    ...catalogueData,
    departmentCode: resolvedDepartmentCode,
    ...(subcategory ? { subcategory } : {}),
    specimenType: catalogueData.specimenType ?? "",
    referenceApproved,
    ...(sourceContainer ? { sourceContainer } : {}),
    ...(sourceMethod ? { sourceMethod } : {}),
    ...(sourceAvailability ? { sourceAvailability } : {}),
    enabled: true,
    createdAt: new Date(),
  });
  await syncOpenOrdersForPanel(database, parsed.data.panel);
  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: "catalogue.test_created",
    recordType: "testDefinition",
    testCode: code,
    panel: parsed.data.panel,
    createdAt: new Date(),
  });
  revalidatePath("/catalogue");
  revalidatePath("/departments");
  revalidatePath("/orders/new");
  revalidatePath("/worklist");
  revalidatePath("/reagents");
  redirect("/catalogue?notice=created");
}

export async function updateCatalogueTest(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const code = value(formData, "code");
  const parsed = readCatalogueTest(formData);
  if (!code || !parsed.success) safeError("/catalogue", "validation");

  const database = await getDatabase();
  const definitions = database.collection<CatalogueTest & { enabled: boolean }>("testDefinitions");
  const current = await definitions.findOne({ code });
  if (!current) safeError("/catalogue", "missing");
  const targetPanelDefinitions = await definitions.find({ panel: parsed.data.panel, code: { $ne: code } }, { projection: { departmentCode: 1 } }).toArray();
  const targetDepartmentCodes = [...new Set(targetPanelDefinitions.map((definition) => definition.departmentCode ?? ""))];
  if (targetDepartmentCodes.length > 1) safeError("/catalogue", "panel-department-mismatch");
  const targetDepartmentCode = current.departmentCode || targetDepartmentCodes[0] || undefined;
  if (current.departmentCode && targetDepartmentCodes[0] && current.departmentCode !== targetDepartmentCodes[0]) safeError("/catalogue", "panel-department-mismatch");
  const duplicate = await definitions.findOne({
    code: { $ne: code },
    panel: parsed.data.panel,
    name: { $regex: `^${parsed.data.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (duplicate) safeError("/catalogue", "duplicate-test");

  const testData = { ...parsed.data };
  delete testData.departmentCode;
  const { sourceContainer, sourceMethod, sourceAvailability, referenceApproved, subcategory, ...catalogueData } = testData;
  const sourceConfiguration = current.sourceWorkbook ? {
    ...(sourceContainer !== undefined ? { sourceContainer } : {}),
    ...(sourceMethod !== undefined ? { sourceMethod } : {}),
    ...(sourceAvailability !== undefined ? { sourceAvailability: sourceAvailability || undefined } : {}),
  } : {};
  const resetClinicalReview = current.requiresClinicalReview ? { clinicalReviewStatus: "PENDING" as const } : {};
  await definitions.updateOne({ code }, {
    $set: { ...catalogueData, ...(subcategory ? { subcategory } : {}), ...(targetDepartmentCode ? { departmentCode: targetDepartmentCode } : {}), ...sourceConfiguration, ...resetClinicalReview, specimenType: catalogueData.specimenType ?? "", referenceApproved, updatedAt: new Date() },
    ...(!subcategory ? { $unset: { subcategory: "" } } : {}),
  });
  await syncOpenOrdersForPanels(database, [current.panel, parsed.data.panel]);
  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: "catalogue.test_updated",
    recordType: "testDefinition",
    testCode: code,
    changedFields: ["panel", "subpanel", "name", "kind", "unit", "sourceReference", "specimenType", "source container", "method", "availability", "reference approval"],
    createdAt: new Date(),
  });
  revalidatePath("/catalogue");
  revalidatePath("/departments");
  revalidatePath("/orders/new");
  redirect("/catalogue?notice=updated");
}

export async function toggleCatalogueTest(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const code = value(formData, "code");
  if (!code) safeError("/catalogue", "validation");
  const database = await getDatabase();
  const definitions = database.collection<CatalogueTest & { enabled: boolean }>("testDefinitions");
  const current = await definitions.findOne({ code });
  if (!current) safeError("/catalogue", "missing");
  if (current.panelHeaderOnly) safeError("/catalogue", "panel-header-not-result");
  const enabled = current.enabled === false;
  await definitions.updateOne({ code }, { $set: { enabled, updatedAt: new Date() } });
  await syncOpenOrdersForPanel(database, current.panel);
  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: enabled ? "catalogue.test_enabled" : "catalogue.test_disabled",
    recordType: "testDefinition",
    testCode: code,
    createdAt: new Date(),
  });
  revalidatePath("/catalogue");
  revalidatePath("/orders/new");
  redirect("/catalogue?notice=updated");
}

const cataloguePriceSchema = z.object({
  panel: z.string().trim().min(1).max(120),
  amount: z.string().trim().regex(/^\d{1,9}(?:\.\d{1,2})?$/),
  effectiveFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(3).max(300),
});

export async function createCataloguePrice(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const parsed = cataloguePriceSchema.safeParse({
    panel: value(formData, "panel"),
    amount: value(formData, "amount"),
    effectiveFrom: value(formData, "effectiveFrom"),
    reason: value(formData, "reason"),
  });
  if (!parsed.success) safeError("/catalogue", "price-validation");

  const [whole, fraction = ""] = parsed.data.amount.split(".");
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  const effectiveFrom = new Date(`${parsed.data.effectiveFrom}T00:00:00.000Z`);
  if (!Number.isSafeInteger(amountMinor) || !Number.isFinite(effectiveFrom.getTime()) || effectiveFrom.toISOString().slice(0, 10) !== parsed.data.effectiveFrom) {
    safeError("/catalogue", "price-validation");
  }

  const database = await getDatabase();
  const duplicatePrice = await database.collection<CataloguePriceRecord>("cataloguePrices").findOne({ panel: parsed.data.panel, effectiveFrom });
  if (duplicatePrice) safeError("/catalogue", "price-date-conflict");
  const definition = await database.collection("testDefinitions").findOne({ panel: parsed.data.panel });
  if (!definition) safeError("/catalogue", "missing");
  const now = new Date();
  const price: CataloguePriceRecord = {
    _id: new ObjectId(),
    panel: parsed.data.panel,
    amountMinor,
    currency: "NGN",
    effectiveFrom,
    reason: parsed.data.reason,
    createdBy: actor._id,
    createdAt: now,
  };
  try {
    await database.collection<CataloguePriceRecord>("cataloguePrices").insertOne(price);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) safeError("/catalogue", "price-date-conflict");
    throw error;
  }
  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: "catalogue.price_created",
    recordType: "cataloguePrice",
    recordId: price._id,
    panel: price.panel,
    amountMinor,
    currency: price.currency,
    effectiveFrom,
    reason: price.reason,
    createdAt: now,
  });
  revalidatePath("/catalogue");
  revalidatePath("/orders/new");
  redirect("/catalogue?notice=price-created");
}



export async function createClient(formData: FormData): Promise<void> {

  const user = await requireUser();

  const parsed = clientSchema.safeParse({

    fullName: value(formData, "fullName"),

    dateOfBirth: value(formData, "dateOfBirth") || undefined,

    sex: value(formData, "sex") || undefined,

    phone: value(formData, "phone") || undefined,

    email: value(formData, "email") || undefined,

    address: value(formData, "address") || undefined,

  });

if (!parsed.success) safeError("/clients/new", "validation");

if (parsed.data.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.dateOfBirth)) {

    safeError("/clients/new", "validation");

  }



  const database = await getDatabase();

  const normalizedName = normalizedPatientName(parsed.data.fullName);
  const namePattern = `^${normalizedName.split("").join("[^a-z0-9]*")}$`;
  const phoneDigits = parsed.data.phone?.replace(/\D/g, "") ?? "";
  const identityClauses: Filter<ClientRecord>[] = normalizedName
    ? [{ fullName: { $regex: namePattern, $options: "i" } }]
    : [];
  if (parsed.data.email) identityClauses.push({ email: { $regex: `^${parsed.data.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
  if (phoneDigits.length >= 7) identityClauses.push({ phone: { $regex: `^${phoneDigits.split("").join("\\D*")}$` } });

  const possibleDuplicates = identityClauses.length
    ? await database.collection<ClientRecord>("clients").find(
      { $or: identityClauses },
      { projection: { fullName: 1, dateOfBirth: 1, phone: 1, email: 1 } },
    ).toArray()
    : [];
  const duplicate = possibleDuplicates.some((existing) => {
    if (!normalizedName) return false;
    if (normalizedPatientName(existing.fullName) !== normalizedName) return false;
    const sameDateOfBirth = Boolean(parsed.data.dateOfBirth && existing.dateOfBirth === parsed.data.dateOfBirth);
    const samePhone = Boolean(phoneDigits.length >= 7 && existing.phone?.replace(/\D/g, "") === phoneDigits);
    const sameEmail = Boolean(parsed.data.email && existing.email?.trim().toLowerCase() === parsed.data.email.toLowerCase());
    return sameDateOfBirth || samePhone || sameEmail;
  });
  if (duplicate) safeError("/clients/new", "duplicate-patient");

  const now = new Date();

  const client: Omit<ClientRecord, "_id"> = {

    patientId: `PT-${randomBytes(4).toString("hex").toUpperCase()}`,

    fullName: parsed.data.fullName,

    ...(parsed.data.dateOfBirth ? { dateOfBirth: parsed.data.dateOfBirth } : {}),

    ...(parsed.data.sex ? { sex: parsed.data.sex } : {}),

    ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),

    ...(parsed.data.email ? { email: parsed.data.email } : {}),

    ...(parsed.data.address ? { address: parsed.data.address } : {}),

    createdAt: now,

    updatedAt: now,

  };

  let insertedId: ObjectId;

try {

    const result = await database.collection("clients").insertOne(client);

    insertedId = result.insertedId;

await database.collection("auditEvents").insertOne({

      actorId: user._id,

      action: "client.created",

      recordType: "client",

      recordId: insertedId,

      createdAt: now,

    });

  } catch {

    safeError("/clients/new", "save");

  }



  revalidatePath("/clients");

  redirect(`/clients/${insertedId.toHexString()}`);

}


export async function deleteClient(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const clientId = value(formData, "clientId");
  if (!ObjectId.isValid(clientId)) safeError("/clients", "invalid-delete");

  const database = await getDatabase();
  const id = new ObjectId(clientId);
  const clients = database.collection<ClientRecord>("clients");
  const orders = database.collection<LabOrder>("labOrders");
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const currentPatient = await clients.findOne({ _id: id }, { session });
      if (!currentPatient) throw new Error("patient-not-found");

      const patientOrders = await orders.find({ clientId: id }, { projection: { _id: 1, reagentUsageCount: 1, authorizedAt: 1, reportVersions: 1, specimenIds: 1 }, session }).toArray();
      if (patientOrders.some((order) => order.authorizedAt || order.reportVersions?.length || order.specimenIds?.length)) throw new Error("patient-has-clinical-history");
      if (await database.collection("specimens").findOne({ patientId: id }, { projection: { _id: 1 }, session })) throw new Error("patient-has-clinical-history");
      if (patientOrders.some((order) => (order.reagentUsageCount ?? 0) > 0) || (patientOrders.length > 0 && await database.collection("reagentStockMovements").findOne({
        referenceType: "labOrderTest",
        referenceId: { $in: patientOrders.map((order) => order._id.toHexString()) },
      }, { session }))) throw new Error("patient-has-reagent-traceability");

      const deletedOrders = await orders.deleteMany({ clientId: id }, { session });
      const deletedPatient = await clients.deleteOne({ _id: id }, { session });
      if (deletedPatient.deletedCount !== 1) throw new Error("patient-not-found");

      await database.collection("auditEvents").insertOne({
        actorId: actor._id,
        action: "client.deleted",
        recordType: "client",
        recordId: id,
        patientId: currentPatient.patientId,
        fullName: currentPatient.fullName,
        deletedLabOrderCount: deletedOrders.deletedCount,
        createdAt: new Date(),
      }, { session });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "patient-not-found") {
      safeError("/clients", "missing");
    }
    if (error instanceof Error && error.message === "patient-has-reagent-traceability") safeError("/clients", "has-reagent-traceability");
    if (error instanceof Error && error.message === "patient-has-clinical-history") safeError("/clients", "clinical-record-retained");
    safeError("/clients", "delete-failed");
  } finally {
    await session.endSession();
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/orders");
  revalidatePath("/reports");
  revalidatePath(`/reports/patients/${clientId}`);
  revalidatePath("/dashboard");
  redirect("/clients?notice=patient-deleted");
}

export async function deleteLabOrder(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const orderId = value(formData, "orderId");
  if (!ObjectId.isValid(orderId)) safeError("/orders", "invalid-delete");

  const database = await getDatabase();
  const id = new ObjectId(orderId);
  const orders = database.collection<LabOrder>("labOrders");
  const session = database.client.startSession();
  let order: LabOrder | undefined;
  try {
    order = await session.withTransaction(async () => {
      const currentOrder = await orders.findOne({ _id: id }, { session });
      if (!currentOrder) throw new Error("order-not-found");
      if ((currentOrder.reagentUsageCount ?? 0) > 0 || await database.collection("reagentStockMovements").findOne({ referenceType: "labOrderTest", referenceId: id.toHexString() }, { session })) throw new Error("order-has-reagent-traceability");

      const linkedSpecimens = currentOrder.specimenIds?.length
        ? { $or: [{ orderId: id }, { _id: { $in: currentOrder.specimenIds } }] }
        : { orderId: id };
      const deletedSpecimens = await database.collection("specimens").deleteMany(linkedSpecimens, { session });
      const deletedOrder = await orders.deleteOne({ _id: id }, { session });
      if (deletedOrder.deletedCount !== 1) throw new Error("order-not-found");

      await database.collection("auditEvents").insertOne({
        actorId: actor._id,
        action: "labOrder.deleted",
        recordType: "labOrder",
        recordId: id,
        accessionId: currentOrder.accessionId,
        patientId: currentOrder.clientSnapshot.patientId,
        patientName: currentOrder.clientSnapshot.fullName,
        testCount: currentOrder.tests.length,
        deletedReportVersionCount: currentOrder.reportVersions?.length ?? 0,
        hadReleasedReport: Boolean(currentOrder.authorizedAt || currentOrder.reportVersions?.length),
        deletedSpecimenCount: deletedSpecimens.deletedCount,
        deletedSpecimenIds: currentOrder.specimenIds ?? [],
        createdAt: new Date(),
      }, { session });
      return currentOrder;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "order-not-found") safeError("/orders", "missing");
    if (error instanceof Error && error.message === "order-has-reagent-traceability") safeError("/orders", "has-reagent-traceability");
    safeError("/orders", "delete-failed");
  } finally {
    await session.endSession();
  }

  if (!order) safeError("/orders", "missing");

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/reports");
  revalidatePath(`/reports/patients/${order.clientId.toHexString()}`);
  revalidatePath("/dashboard");
  redirect("/orders?notice=order-deleted");
}

export async function deleteApprovedOrderTest(formData: FormData): Promise<void> {
  const actor = await requireUser(["Administrator"]);
  const orderId = value(formData, "orderId");
  const testCode = value(formData, "testCode");
  if (!ObjectId.isValid(orderId) || !testCode) safeError("/orders", "invalid-delete");

  const database = await getDatabase();
  const orders = database.collection<LabOrder>("labOrders");
  const orderObjectId = new ObjectId(orderId);
  const order = await orders.findOne({ _id: orderObjectId });
  if (!order) safeError("/orders", "missing");
  if (order.authorizedAt || order.reportVersions?.length) safeError(`/orders/${orderId}`, "clinical-record-retained");
  if (order.specimenIds?.length) safeError(`/orders/${orderId}`, "specimen-history");

  const test = order.tests.find((item) => item.code === testCode);
  if (!test) safeError(`/orders/${orderId}`, "missing-test");
  if (test.status !== "Completed") safeError(`/orders/${orderId}`, "test-not-approved");
  const hasReagentHistory = await database.collection("reagentStockMovements").findOne({ referenceType: "labOrderTest", referenceId: orderId, testCode });
  if (hasReagentHistory || (test.reagentUsageCount ?? 0) > 0) safeError(`/orders/${orderId}`, "test-has-reagent-traceability");

  const updatedTests = order.tests.filter((item) => item.code !== testCode);
  const updateFields: Record<string, unknown> = {
    tests: updatedTests,
    status: overallOrderStatus(updatedTests.map((item) => item.status as TestStatus)),
    updatedAt: new Date(),
  };
  const update = updatedTests.length === 0
    ? { $set: updateFields, $unset: { authorizedBy: "", authorizedByName: "", authorizedByEmail: "", authorizedByRole: "", authorizedAt: "" } as const }
    : { $set: updateFields };
  const result = await orders.updateOne({
    _id: orderObjectId,
    updatedAt: order.updatedAt,
    ...(order.reagentUsageCount === undefined ? { reagentUsageCount: { $exists: false } } : { reagentUsageCount: order.reagentUsageCount }),
  }, update);
  if (result.modifiedCount !== 1) safeError(`/orders/${orderId}`, "transition");

  await database.collection("auditEvents").insertOne({
    actorId: actor._id,
    action: "labOrder.approved_test_deleted",
    recordType: "labOrder",
    recordId: orderObjectId,
    accessionId: order.accessionId,
    testCode: test.code,
    testName: test.name,
    previousStatus: test.status,
    createdAt: new Date(),
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/reports/${orderId}`);
  revalidatePath(`/reports/patients/${order.clientId.toHexString()}`);
  revalidatePath("/worklist");
  revalidatePath("/dashboard");
  redirect(`/orders/${orderId}?notice=test-deleted`);
}



export async function createOrder(formData: FormData): Promise<void> {

  const user = await requireUser(["Administrator", "Reception", "Laboratory Staff"]);

  const clientId = value(formData, "clientId");

  const rawPanelSelections = formData.getAll("selectedPanelKeys").filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  const panelSelections: Array<{ departmentCode: string; panel: string }> = [];
  for (const rawSelection of rawPanelSelections) {
    let selection: { departmentCode?: unknown; panel?: unknown };
    try {
      selection = JSON.parse(rawSelection) as { departmentCode?: unknown; panel?: unknown };
    } catch {
      safeError("/orders/new", "validation");
    }
    if (typeof selection.departmentCode !== "string" || typeof selection.panel !== "string" || !selection.panel.trim() || selection.panel.length > 120) safeError("/orders/new", "validation");
    panelSelections.push({ departmentCode: selection.departmentCode, panel: selection.panel.trim() });
  }
  const selectedPanelNames = [...new Set(panelSelections.map((selection) => selection.panel))];

  const specimenType = value(formData, "specimenType").slice(0, 120);

if (!ObjectId.isValid(clientId)) safeError("/orders/new", "patient-required");

if (panelSelections.length === 0 || panelSelections.length > 100 || selectedPanelNames.length !== panelSelections.length) {

    safeError("/orders/new", "validation");

  }



  const database = await getDatabase();
  const now = new Date();
  const [client, activeDepartments, definitionCandidates, priceRecords] = await Promise.all([
    database.collection<ClientRecord>("clients").findOne({ _id: new ObjectId(clientId) }),
    database.collection<DepartmentRecord>("departments").find({ active: true, departmentKind: { $ne: "ORDER_GROUP" } }).toArray(),
    database.collection<OrderedTest & { enabled: boolean; panelHeaderOnly?: boolean }>("testDefinitions")
      .find({ panel: { $in: selectedPanelNames }, enabled: true, panelHeaderOnly: { $ne: true } }).toArray(),
    database.collection<CataloguePriceRecord>("cataloguePrices")
      .find({ panel: { $in: selectedPanelNames }, effectiveFrom: { $lte: now } }).sort({ effectiveFrom: -1 }).toArray(),
  ]);

if (!client) safeError("/orders/new", "validation");

  // Keep the server-side panel contents in sync with the new-order page. The
  // page only exposes tests assigned to active departments (plus legacy
  // unassigned tests); including tests from archived departments here can
  // make a valid panel selection look like it spans multiple departments.
  const activeDepartmentCodes = new Set(activeDepartments.map((department) => department.code));
  const definitions = definitionCandidates.filter((item) => !item.departmentCode || activeDepartmentCodes.has(item.departmentCode));

if (definitions.length === 0 || selectedPanelNames.some((panel) => !definitions.some((definition) => definition.panel === panel))) {

    safeError("/orders/new", "validation");

  }

  const requestedDepartmentByPanel = new Map(panelSelections.map((selection) => [selection.panel, selection.departmentCode]));
  const departmentByPanel = new Map<string, Set<string>>();
  for (const definition of definitions) departmentByPanel.set(definition.panel, new Set([...(departmentByPanel.get(definition.panel) ?? []), definition.departmentCode ?? "__unassigned__"]));
  if (selectedPanelNames.some((panel) => {
    const departmentsForPanel = departmentByPanel.get(panel);
    return !departmentsForPanel || departmentsForPanel.size !== 1 || !departmentsForPanel.has(requestedDepartmentByPanel.get(panel) ?? "");
  })) safeError("/orders/new", "department-test-mismatch");

  const testDepartments = [...new Set(panelSelections.flatMap((selection) => selection.departmentCode !== "__unassigned__" ? [selection.departmentCode] : []))];

  const configuredDepartmentCodes = testDepartments;
  const departmentNames = new Map(activeDepartments.map((department) => [department.code, department.name]));
  if (configuredDepartmentCodes.some((code) => !departmentNames.has(code))) safeError("/orders/new", "inactive-department");

  const selectedPanels = selectedPanelNames;



  const latestPriceByPanel = new Map<string, CataloguePriceRecord>();
  for (const price of priceRecords) {
    if (!latestPriceByPanel.has(price.panel)) latestPriceByPanel.set(price.panel, price);
  }
  const priceSnapshots = selectedPanels.map((panel) => {
    const price = latestPriceByPanel.get(panel);
    return {
      panel,
      ...(price ? { amountMinor: price.amountMinor, priceRecordId: price._id } : {}),
      currency: "NGN" as const,
      capturedAt: now,
    };
  });

  const tests: OrderedTest[] = definitions.map((definition) => ({

    code: definition.code,

    panel: definition.panel,

    ...(definition.subcategory ? { subcategory: definition.subcategory } : {}),

    name: definition.name,

    kind: definition.kind,

    unit: definition.unit,

    sourceReference: definition.sourceReference,

    referenceApproved: definition.referenceApproved,

    specimenType: specimenType || definition.specimenType || "",
    ...(definition.departmentCode ? { departmentCode: definition.departmentCode, departmentName: departmentNames.get(definition.departmentCode) } : {}),

    status: "Pending",

    result: "",

  }));

  const specimenGroups = new Map<string, OrderedTest[]>();
  for (const test of tests) {
    const type = test.specimenType?.trim();
    if (type) specimenGroups.set(type, [...(specimenGroups.get(type) ?? []), test]);
  }
  const orderId = new ObjectId();
  const specimenIds: ObjectId[] = [];
  const specimenRecords: SpecimenRecord[] = [...specimenGroups.entries()].map(([type, linkedTests]) => {
    const specimenObjectId = new ObjectId();
    specimenIds.push(specimenObjectId);
    return {
      _id: specimenObjectId,
      specimenId: `SP-${now.toISOString().slice(2, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`,
      patientId: client._id,
      patientName: client.fullName,
      patientNumber: client.patientId,
      orderId,
      accessionId: "",
      testCodes: linkedTests.map((test) => test.code),
      departmentCodes: [...new Set(linkedTests.flatMap((test) => test.departmentCode ? [test.departmentCode] : []))],
      departmentNames: [...new Set(linkedTests.flatMap((test) => test.departmentName ? [test.departmentName] : []))],
      specimenType: type,
      status: "ORDERED",
      createdAt: now,
      updatedAt: now,
      events: [{ action: "ORDERED", toStatus: "ORDERED", actorId: user._id, occurredAt: now }],
    };
  });
  const accessionId = `LAB-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
  for (const specimen of specimenRecords) specimen.accessionId = accessionId;

  const order: Omit<LabOrder, "_id"> = {
    accessionId,

    clientId: client._id,

    clientSnapshot: {

      patientId: client.patientId,

      fullName: client.fullName,

      ...(client.dateOfBirth ? { dateOfBirth: client.dateOfBirth } : {}),

      ...(client.sex ? { sex: client.sex } : {}),

      ...(client.phone ? { phone: client.phone } : {}),

      ...(client.email ? { email: client.email } : {}),

      ...(client.address ? { address: client.address } : {}),

    },

    reportDetails: {
      surname: "",
      otherNames: client.fullName,
      laboratoryNo: accessionId,
      hospitalNo: "",
      age: "",
      ageUnit: "years",
      sex: client.sex ?? "",
      date: now.toISOString().slice(0, 10),
      requestedTest: selectedPanels.map(displayPanelName).join(", "),
      specimen: specimenType || [...new Set(tests.map((test) => test.specimenType).filter(Boolean))].join(", "),
      generalComment: "",
      filmReport: "",
      filmRBCs: "",
      filmWBCs: "",
      filmPlatelets: "",
      filmMalaria: "",
    },

    createdBy: user._id.toHexString(),

    createdAt: now,

    updatedAt: now,

    status: "Pending",

    tests,
    priceSnapshots,
    ...(specimenIds.length ? { specimenIds } : {}),

    // Removed notes field

  };

  try {
    const insertResults = await Promise.allSettled([
      database.collection("labOrders").insertOne({ ...order, _id: orderId }),
      ...(specimenRecords.length ? [database.collection<SpecimenRecord>("specimens").insertMany(specimenRecords, { ordered: true })] : []),
    ]);
    const failedInsert = insertResults.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failedInsert) throw failedInsert.reason;

    await database.collection("auditEvents").insertOne({

    actorId: user._id,

    action: "order.created",

    recordType: "labOrder",

    recordId: orderId,

    panels: selectedPanels,

    specimenType,

    priceSnapshots: priceSnapshots.map(({ panel, amountMinor, currency, priceRecordId }) => ({ panel, amountMinor, currency, priceRecordId })),

    createdAt: now,

    });
  } catch (error) {
    await Promise.allSettled([
      database.collection("specimens").deleteMany({ orderId }),
      database.collection("labOrders").deleteOne({ _id: orderId }),
    ]);
    throw error;
  }

  revalidatePath("/orders");

  revalidatePath("/dashboard");

  redirect(`/orders/${orderId.toHexString()}?notice=created`);

}



export async function updateOrderedTest(formData: FormData): Promise<void> {

  const action = value(formData, "action") as TestAction;

  const user = await requireUser();
  if (action === "complete") {
    if (!canAuthorizeReports(user)) safeError("/dashboard", "forbidden");
  } else if (user.role !== "Administrator" && user.role !== "Laboratory Staff") {
    safeError("/dashboard", "forbidden");
  }

  const orderId = value(formData, "orderId");

  const testCode = value(formData, "testCode");

  const resultText = value(formData, "result");

  const specimenType = value(formData, "specimenType").slice(0, 120);



if (!ObjectId.isValid(orderId) || !testCode || !["save", "submit", "complete"].includes(action)) {

    safeError("/worklist", "validation");

  }

  if (action !== "complete" && resultText.length > 3000) safeError(`/orders/${orderId}`, "result-validation");



  const database = await getDatabase();

  const orders = database.collection<LabOrder>("labOrders");

  const order = await orders.findOne({ _id: new ObjectId(orderId) });

if (!order) safeError("/worklist", "missing");
  if (order.authorizedAt && action !== "complete") safeError(`/orders/${orderId}`, "amendment-required");

  const test = order.tests.find((item) => item.code === testCode);

if (!test) safeError(`/orders/${orderId}`, "missing");

  const nextStatus = nextTestStatus(action, test.status as TestStatus);

if (!nextStatus) safeError(`/orders/${orderId}`, "transition");

  if (action === "complete") {
    const rejectedTestCodes = await testsWithRejectedSpecimens(database, order._id, order.tests.map((item) => item.code));
    if (rejectedTestCodes.has(testCode)) safeError(`/orders/${orderId}`, "rejected-specimen");
    const finalTestCodes = order.tests.every((item) => item.code === testCode || item.status === "Completed")
      ? order.tests.map((item) => item.code)
      : [testCode];
    if (order.tests.every((item) => item.code === testCode || item.status === "Completed") && rejectedTestCodes.size) safeError(`/orders/${orderId}`, "rejected-specimen");
    if ((await testsBlockedByQualityControl(database, finalTestCodes)).length) safeError(`/orders/${orderId}`, "qc-blocked");
  }

  const now = new Date();

  const changedFields = action === "complete" ? [] : [

    ...(resultText !== test.result ? ["result"] : []),

    ...(specimenType !== (test.specimenType ?? "") ? ["specimenType"] : []),

  ];

  const setValues: Record<string, unknown> = {

    "tests.$[item].status": nextStatus,

    "tests.$[item].updatedAt": now,

    "tests.$[item].updatedBy": user._id.toHexString(),

    updatedAt: now,

  };

if (action !== "complete") {

    setValues["tests.$[item].result"] = resultText;

    setValues["tests.$[item].specimenType"] = specimenType;

    setValues["tests.$[item].reviewedAt"] = null;

    setValues["tests.$[item].reviewedBy"] = null;

  } else {

    setValues["tests.$[item].reviewedAt"] = now;

    setValues["tests.$[item].reviewedBy"] = user._id.toHexString();

  }



  const updated = await orders.updateOne(

    { _id: order._id, tests: { $elemMatch: { code: testCode, status: test.status } } },

    { $set: setValues, ...(action !== "complete" ? { $unset: { "tests.$[item].resultValue": "" } } : {}) },

    { arrayFilters: [{ "item.code": testCode, "item.status": test.status }] },

  );

if (updated.modifiedCount !== 1) safeError(`/orders/${orderId}`, "transition");



  const statuses = order.tests.map((item) => item.code === testCode ? nextStatus : item.status as TestStatus);

  const orderUpdate: Record<string, unknown> = { status: overallOrderStatus(statuses), updatedAt: now };
  if (action === "complete" && statuses.length > 0 && statuses.every((status) => status === "Completed")) {
    orderUpdate.authorizedBy = user._id.toHexString();
    orderUpdate.authorizedByName = user.name;
    orderUpdate.authorizedByEmail = user.email;
    orderUpdate.authorizedByRole = user.role;
    orderUpdate.authorizedAt = now;
    const releasedTests = order.tests.map((item) => item.code === testCode
      ? { ...item, status: nextStatus, reviewedAt: now, reviewedBy: user._id.toHexString(), updatedAt: now, updatedBy: user._id.toHexString() }
      : item);
    orderUpdate.reportVersions = [...(order.reportVersions ?? []), buildReleasedReportVersion(order, releasedTests, {
      at: now, actorId: user._id.toHexString(), actorName: user.name, actorRole: user.role,
    })];
  }
  await orders.updateOne({ _id: order._id }, {
    $set: orderUpdate,
    ...(orderUpdate.reportVersions ? { $unset: { pendingAmendment: "" } } : {}),
  });

await database.collection("auditEvents").insertOne({

    actorId: user._id,

    action: action === "save" ? (changedFields.length ? "test.edited" : "test.saved") : `test.${action}`,

    recordType: "labOrder",

    recordId: order._id,

    testCode,

    changedFields,

    fromStatus: test.status,

    toStatus: nextStatus,

    createdAt: now,

  });

  if (orderUpdate.reportVersions) {
    const version = (orderUpdate.reportVersions as NonNullable<LabOrder["reportVersions"]>).at(-1)!;
    await database.collection("auditEvents").insertOne({ actorId: user._id, action: "report.released", recordType: "labOrder", recordId: order._id, accessionId: order.accessionId, reportVersion: version.version, releasedAt: now, reason: version.amendmentReason, createdAt: now });
  }



  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/reports/${orderId}`);

  revalidatePath("/worklist");

  revalidatePath("/dashboard");

  redirect(`/orders/${orderId}?notice=${action}`);

}

export async function updateReportDetails(formData: FormData): Promise<void> {
  const user = await requireUser(["Administrator", "Reception", "Laboratory Staff"]);
  const orderId = value(formData, "orderId");
  if (!ObjectId.isValid(orderId)) safeError("/orders", "validation");

  const parsed = reportDetailsSchema.safeParse({
    surname: value(formData, "surname"),
    otherNames: value(formData, "otherNames"),
    laboratoryNo: value(formData, "laboratoryNo"),
    hospitalNo: value(formData, "hospitalNo"),
    age: value(formData, "age"),
    ageUnit: value(formData, "ageUnit"),
    sex: value(formData, "sex"),
    date: value(formData, "reportDate"),
    requestedTest: "",
    specimen: value(formData, "reportSpecimen"),
    generalComment: value(formData, "generalComment"),
    filmReport: value(formData, "filmReport"),
    filmRBCs: value(formData, "filmRBCs"),
    filmWBCs: value(formData, "filmWBCs"),
    filmPlatelets: value(formData, "filmPlatelets"),
    filmMalaria: value(formData, "filmMalaria"),
  });
  if (!parsed.success || (parsed.data.age && !/^\d{1,3}(?:\.\d{1,2})?$/.test(parsed.data.age))) {
    safeError(`/orders/${orderId}`, "report-details-validation");
  }
  const reportDate = new Date(`${parsed.data.date}T00:00:00.000Z`);
  if (Number.isNaN(reportDate.valueOf()) || reportDate.toISOString().slice(0, 10) !== parsed.data.date) {
    safeError(`/orders/${orderId}`, "report-details-validation");
  }

  const database = await getDatabase();
  const orders = database.collection<LabOrder>("labOrders");
  const orderObjectId = new ObjectId(orderId);
  const order = await orders.findOne({ _id: orderObjectId });
  if (!order) safeError("/orders", "missing");
  if (order.authorizedAt || order.reportVersions?.length) safeError(`/orders/${orderId}`, "amendment-required");

  const nextDetails: LabReportDetails = {
    ...parsed.data,
    requestedTest: [...new Set(order.tests.map((test) => displayPanelName(test.panel)))].join(", "),
  };
  const previous = order.reportDetails;
  const changedFields = (Object.keys(nextDetails) as Array<keyof LabReportDetails>)
    .filter((field) => (previous?.[field] ?? "") !== nextDetails[field]);
  const now = new Date();
  const updated = await orders.updateOne(
    { _id: orderObjectId, updatedAt: order.updatedAt, authorizedAt: { $exists: false } },
    { $set: { reportDetails: nextDetails, updatedAt: now } },
  );
  if (updated.modifiedCount !== 1) safeError(`/orders/${orderId}`, "transition");

  await database.collection("auditEvents").insertOne({
    actorId: user._id,
    action: changedFields.length ? "report.details_updated" : "report.details_saved",
    recordType: "labOrder",
    recordId: orderObjectId,
    accessionId: order.accessionId,
    changedFields,
    createdAt: now,
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/reports/${orderId}`);
  revalidatePath("/reports");
  redirect(`/orders/${orderId}?notice=report-details-saved`);
}

export async function updateOrderTests(formData: FormData): Promise<void> {
  const action = value(formData, "action");
  const orderId = value(formData, "orderId");
  const isReview = action === "completeAll";

  const user = await requireUser();
  if (isReview ? !canAuthorizeReports(user) : user.role !== "Administrator" && user.role !== "Laboratory Staff") {
    safeError(`/orders/${orderId}`, "forbidden");
  }

  if (!ObjectId.isValid(orderId) || !["saveAll", "submitAll", "completeAll"].includes(action)) {
    safeError("/worklist", "validation");
  }

  const database = await getDatabase();
  const orders = database.collection<LabOrder>("labOrders");
  const orderObjectId = new ObjectId(orderId);
  const order = await orders.findOne({ _id: orderObjectId });
  if (!order) safeError("/worklist", "missing");
  if (order.authorizedAt && action !== "completeAll") safeError(`/orders/${orderId}`, "amendment-required");

  const rejectedTestCodes = action === "completeAll"
    ? await testsWithRejectedSpecimens(database, orderObjectId, order.tests.map((test) => test.code))
    : new Set<string>();

  if (action === "completeAll") {
    if (rejectedTestCodes.size) safeError(`/orders/${orderId}`, "rejected-specimen");
    const completableTestCodes = order.tests.filter((test) => test.status === "Awaiting Review" && !rejectedTestCodes.has(test.code)).map((test) => test.code);
    if ((await testsBlockedByQualityControl(database, completableTestCodes)).length) safeError(`/orders/${orderId}`, "qc-blocked");
  }

  const now = new Date();
  const actorId = user._id.toHexString();
  let changedCount = 0;
  const auditEntries: Record<string, unknown>[] = [];
  const updatedTests: LabOrder["tests"] = order.tests.map((test): LabOrder["tests"][number] => {
    const status = test.status as TestStatus;

    if (action === "completeAll") {
      if (status !== "Awaiting Review") return test;
      changedCount += 1;
      auditEntries.push({
        actorId: user._id,
        action: "test.complete",
        recordType: "labOrder",
        recordId: orderObjectId,
        testCode: test.code,
        fromStatus: status,
        toStatus: "Completed",
        createdAt: now,
      });
      return { ...test, status: "Completed", reviewedAt: now, reviewedBy: actorId, updatedAt: now, updatedBy: actorId };
    }

    // Do not alter tests that have already been submitted or reviewed.
    if (status === "Awaiting Review" || status === "Completed") return test;

    const resultText = value(formData, `result_${test.code}`);
    if (resultText.length > 3000) safeError(`/orders/${orderId}`, "result-validation");
    const specimenType = value(formData, `specimen_${test.code}`).slice(0, 120) || test.specimenType || "";
    const unit = value(formData, `unit_${test.code}`).slice(0, 60);
    const sourceReference = value(formData, `reference_${test.code}`).slice(0, 240);
    const changedFields = [
      ...(resultText !== (test.result ?? "") ? ["result"] : []),
      ...(specimenType !== (test.specimenType ?? "") ? ["specimenType"] : []),
      ...(unit !== test.unit ? ["unit"] : []),
      ...(sourceReference !== test.sourceReference ? ["sourceReference"] : []),
    ];

    const testWithoutNumericResult = { ...test };
    delete testWithoutNumericResult.resultValue;
    let nextStatus: TestStatus = status;
    if (action === "saveAll") {
      nextStatus = nextTestStatus("save", status) ?? status;
    } else {
      const savedStatus = nextTestStatus("save", status) ?? status;
      nextStatus = nextTestStatus("submit", savedStatus) ?? (savedStatus === "In Progress" ? "Awaiting Review" : savedStatus);
      if (nextStatus !== "Awaiting Review") return { ...testWithoutNumericResult, result: resultText, specimenType, unit, sourceReference };
    }

    changedCount += 1;
    auditEntries.push({
      actorId: user._id,
      action: action === "saveAll" ? (changedFields.length ? "test.edited" : "test.saved") : "test.submit",
      recordType: "labOrder",
      recordId: orderObjectId,
      testCode: test.code,
      changedFields,
      fromStatus: status,
      toStatus: nextStatus,
      createdAt: now,
    });

    return {
      ...testWithoutNumericResult,
      result: resultText,
      specimenType,
      unit,
      sourceReference,
      status: nextStatus,
      updatedAt: now,
      updatedBy: actorId,
      reviewedAt: undefined,
      reviewedBy: undefined,
    };
  });

  if (action === "submitAll") {
    const eligible = order.tests.filter((test) => test.status === "Pending" || test.status === "In Progress");
    if (eligible.length === 0) safeError(`/orders/${orderId}`, "nothing-to-submit");
    if (updatedTests.some((test) => eligible.some((item) => item.code === test.code) && test.status !== "Awaiting Review")) {
      safeError(`/orders/${orderId}`, "transition");
    }
  }

  if (action === "completeAll" && changedCount === 0) safeError(`/orders/${orderId}`, rejectedTestCodes.size ? "rejected-specimen" : "nothing-to-review");
  if (action === "saveAll" && changedCount === 0) safeError(`/orders/${orderId}`, "nothing-to-save");

  // Do not authorize a final report until every test in the order is completed.
  if (action === "completeAll" && updatedTests.some((test) => test.status !== "Completed")) {
    safeError(`/orders/${orderId}`, "order-not-ready");
  }

  const statuses = updatedTests.map((test) => test.status as TestStatus);
  const orderSet: Record<string, unknown> = {
    tests: updatedTests,
    status: overallOrderStatus(statuses),
    updatedAt: now,
  };

  // Capture the identity of whichever authorized user approved the report.
  if (action === "completeAll") {
    orderSet.authorizedBy = actorId;
    orderSet.authorizedByName = user.name;
    orderSet.authorizedByEmail = user.email;
    orderSet.authorizedByRole = user.role;
    orderSet.authorizedAt = now;
    orderSet.reportVersions = [...(order.reportVersions ?? []), buildReleasedReportVersion(order, updatedTests, {
      at: now, actorId, actorName: user.name, actorRole: user.role,
    })];
  }

  const updated = await orders.updateOne(
    { _id: orderObjectId, updatedAt: order.updatedAt },
    { $set: orderSet, ...(action === "completeAll" ? { $unset: { pendingAmendment: "" } } : {}) },
  );
  if (updated.modifiedCount !== 1) safeError(`/orders/${orderId}`, "transition");

  if (auditEntries.length) await database.collection("auditEvents").insertMany(auditEntries);
  await database.collection("auditEvents").insertOne({
    actorId: user._id,
    action: action === "saveAll" ? "order.tests_saved" : action === "submitAll" ? "order.tests_submitted" : "order.tests_reviewed",
    recordType: "labOrder",
    recordId: orderObjectId,
    testCount: changedCount,
    createdAt: now,
  });
  if (action === "completeAll") {
    const versions = order.reportVersions ?? [];
    await database.collection("auditEvents").insertOne({ actorId: user._id, action: "report.released", recordType: "labOrder", recordId: orderObjectId, accessionId: order.accessionId, reportVersion: versions.at(-1)?.version ? versions.at(-1)!.version + 1 : 1, releasedAt: now, reason: order.pendingAmendment?.reason, createdAt: now });
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/reports/${orderId}`);
  revalidatePath("/worklist");
  revalidatePath("/dashboard");
  redirect(`/orders/${orderId}?notice=${action}`);
}

export async function updateClient(formData: FormData): Promise<void> {

  const user = await requireUser(["Administrator", "Reception"]);

  const clientId = value(formData, "clientId");

  const parsed = clientSchema.safeParse({

    fullName: value(formData, "fullName"),

    dateOfBirth: value(formData, "dateOfBirth") || undefined,

    sex: value(formData, "sex") || undefined,

    phone: value(formData, "phone") || undefined,

    email: value(formData, "email") || undefined,

    address: value(formData, "address") || undefined,

  });

if (!ObjectId.isValid(clientId) || !parsed.success) safeError(`/clients/${clientId}`, "validation");



  const database = await getDatabase();

  const patients = database.collection<ClientRecord>("clients");

  const patientObjectId = new ObjectId(clientId);

  const previous = await patients.findOne({ _id: patientObjectId });

if (!previous) safeError(`/clients/${clientId}`, "missing");

  const changedFields = [

    ...(parsed.data.fullName !== previous.fullName ? ["fullName"] : []),

    ...(["dateOfBirth", "sex", "phone", "email", "address"] as const).filter((field) => (parsed.data[field] ?? "") !== (previous[field] ?? "")),

  ];

  const setFields: Record<string, unknown> = { fullName: parsed.data.fullName, updatedAt: new Date() };

  const unsetFields: Record<string, ""> = {};

for (const field of ["dateOfBirth", "sex", "phone", "email", "address"] as const) {

if (parsed.data[field]) setFields[field] = parsed.data[field];

else unsetFields[field] = "";

  }

await patients.updateOne(

    { _id: patientObjectId },

    { $set: setFields, ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}) },

  );

await database.collection("auditEvents").insertOne({

    actorId: user._id,

    action: "client.updated",

    recordType: "client",

    recordId: patientObjectId,

    changedFields,

    createdAt: new Date(),

  });

  revalidatePath(`/clients/${clientId}`);

  revalidatePath("/clients");

  redirect(`/clients/${clientId}?notice=saved`);

}
