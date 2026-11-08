import type { ReagentLotRecord, ReagentLotStatus } from "@/lib/models";

export type LotAction = "begin-verification" | "approve" | "reject" | "open" | "dispose";

const lifecycle: Record<LotAction, Partial<Record<ReagentLotStatus, ReagentLotStatus>>> = {
  "begin-verification": { QUARANTINED: "PENDING_VERIFICATION" },
  approve: { PENDING_VERIFICATION: "APPROVED" },
  reject: { PENDING_VERIFICATION: "REJECTED" },
  open: { APPROVED: "IN_USE" },
  dispose: { APPROVED: "DISPOSED", IN_USE: "DISPOSED", EXPIRED: "DISPOSED" },
};

export function nextLotStatus(action: LotAction, status: ReagentLotStatus): ReagentLotStatus | null {
  return lifecycle[action][status] ?? null;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayKey(now = new Date(), timeZone = "Africa/Lagos"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function daysSince(date: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && dateKey(date) === value ? date : null;
}

export function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function effectiveExpiryDate(lot: Pick<ReagentLotRecord, "expiryDate" | "inUseExpiryDate">): Date {
  if (lot.inUseExpiryDate && lot.inUseExpiryDate < lot.expiryDate) return lot.inUseExpiryDate;
  return lot.expiryDate;
}

export function isLotExpired(
  lot: Pick<ReagentLotRecord, "expiryDate" | "inUseExpiryDate">,
  now = new Date(),
): boolean {
  return dateKey(effectiveExpiryDate(lot)) <= todayKey(now);
}

export function lotEffectiveStatus(lot: ReagentLotRecord, now = new Date()): ReagentLotStatus {
  if (["DISPOSED", "REJECTED", "EXHAUSTED", "EXPIRED"].includes(lot.status)) return lot.status;
  if (lot.currentQuantity <= 0) return "EXHAUSTED";
  return isLotExpired(lot, now) ? "EXPIRED" : lot.status;
}

export function canUseLot(lot: ReagentLotRecord, now = new Date()): boolean {
  return lot.currentQuantity > 0
    && (lot.status === "APPROVED" || lot.status === "IN_USE")
    && !isLotExpired(lot, now);
}

export function fefoLot<T extends ReagentLotRecord>(lots: T[], now = new Date()): T | null {
  return lots
    .filter((lot) => canUseLot(lot, now))
    .sort((left, right) => effectiveExpiryDate(left).valueOf() - effectiveExpiryDate(right).valueOf())[0] ?? null;
}

export function expiringWithinDays(
  lot: Pick<ReagentLotRecord, "expiryDate" | "inUseExpiryDate">,
  days: number,
  now = new Date(),
): boolean {
  const today = parseDateOnly(todayKey(now));
  if (!today || isLotExpired(lot, now)) return false;
  const through = addCalendarDays(today, days);
  const expiry = effectiveExpiryDate(lot);
  return dateKey(expiry) <= dateKey(through);
}
