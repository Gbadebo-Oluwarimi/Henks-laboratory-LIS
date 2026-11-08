import { loadEnvConfig } from "@next/env";
import { MongoClient } from "mongodb";
import { hashPassword } from "../src/lib/password";

loadEnvConfig(process.cwd());

async function main() {
  const { MONGODB_URI, AUTH_SECRET, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!MONGODB_URI) throw new Error("Set MONGODB_URI before creating an administrator.");
  if (!AUTH_SECRET || AUTH_SECRET.length < 32) throw new Error("Set AUTH_SECRET to at least 32 characters before creating an administrator.");
  if (!ADMIN_NAME?.trim() || !ADMIN_EMAIL?.trim() || !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD for this one-time command.");
  }
  if (ADMIN_PASSWORD.length < 14 || ADMIN_PASSWORD.length > 256) {
    throw new Error("ADMIN_PASSWORD must be between 14 and 256 characters.");
  }

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const users = client.db().collection("users");
    await users.createIndex({ email: 1 }, { unique: true });
    if (await users.countDocuments() > 0) {
      throw new Error("An account already exists. This command only creates the first administrator.");
    }
    await users.insertOne({
      name: ADMIN_NAME.trim().slice(0, 100),
      email: ADMIN_EMAIL.trim().toLowerCase(),
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      role: "Administrator",
      active: true,
      createdAt: new Date(),
    });
    console.log("Administrator created. Remove ADMIN_PASSWORD from .env.local when finished.");
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Administrator setup failed.");
  process.exitCode = 1;
});
