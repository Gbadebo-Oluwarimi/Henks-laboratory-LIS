import type { Db } from "mongodb";
import type { QualityControlConfigRecord, QualityControlRunRecord } from "@/lib/models";

/** A missing configuration means QC release gating has not been configured for that test. */
export async function testsBlockedByQualityControl(database: Db, testCodes: string[]): Promise<string[]> {
  const configs = await database.collection<QualityControlConfigRecord>("qualityControlConfigs")
    .find({ testCode: { $in: [...new Set(testCodes)] }, active: true, requiresPassedQc: true })
    .toArray();
  if (!configs.length) return [];

  const runs = await database.collection<QualityControlRunRecord>("qualityControlRuns")
    .find({ configId: { $in: configs.map((config) => config._id) } })
    .sort({ runAt: -1 })
    .toArray();
  const latestByConfig = new Map<string, QualityControlRunRecord>();
  for (const run of runs) if (!latestByConfig.has(run.configId.toHexString())) latestByConfig.set(run.configId.toHexString(), run);
  const now = new Date();
  return configs.filter((config) => config.expiresAt <= now || latestByConfig.get(config._id.toHexString())?.status !== "PASS").map((config) => config.testCode);
}

export function evaluateNumericQc(value: number, minimumAccepted: number, maximumAccepted: number, expiresAt: Date, now = new Date()): "PASS" | "FAIL" | "INVALID" {
  if (!Number.isFinite(value) || expiresAt < now) return "INVALID";
  return value >= minimumAccepted && value <= maximumAccepted ? "PASS" : "FAIL";
}
