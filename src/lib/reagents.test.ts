import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";

import type { ReagentLotRecord } from "@/lib/models";
import { canUseLot, effectiveExpiryDate, expiringWithinDays, fefoLot, isLotExpired, nextLotStatus } from "@/lib/reagents";

function lot(overrides: Partial<ReagentLotRecord> = {}): ReagentLotRecord {
  return {
    _id: new ObjectId(),
    reagentId: new ObjectId(),
    lotNumber: "LOT-A",
    quantityReceived: 10,
    currentQuantity: 10,
    unit: "kit",
    dateReceived: new Date("2026-10-01T00:00:00.000Z"),
    expiryDate: new Date("2027-01-01T00:00:00.000Z"),
    storageLocationId: new ObjectId(),
    status: "APPROVED",
    receivedBy: "user-a",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

test("lot lifecycle permits only configured transitions", () => {
  assert.equal(nextLotStatus("begin-verification", "QUARANTINED"), "PENDING_VERIFICATION");
  assert.equal(nextLotStatus("approve", "PENDING_VERIFICATION"), "APPROVED");
  assert.equal(nextLotStatus("reject", "PENDING_VERIFICATION"), "REJECTED");
  assert.equal(nextLotStatus("approve", "QUARANTINED"), null);
  assert.equal(nextLotStatus("open", "REJECTED"), null);
});

test("manufacturer expiry and in-use expiry use the earlier date", () => {
  const reagentLot = lot({ inUseExpiryDate: new Date("2026-12-01T00:00:00.000Z") });
  assert.equal(effectiveExpiryDate(reagentLot).toISOString().slice(0, 10), "2026-12-01");
  assert.equal(isLotExpired(reagentLot, new Date("2026-12-01T12:00:00.000Z")), true);
  assert.equal(isLotExpired(lot(), new Date("2026-12-31T12:00:00.000Z")), false);
});

test("only approved, in-date stock is usable and FEFO selects the earliest expiry", () => {
  const now = new Date("2026-10-23T12:00:00.000Z");
  const later = lot({ lotNumber: "LATER", expiryDate: new Date("2027-06-01T00:00:00.000Z") });
  const earlier = lot({ lotNumber: "EARLIER", expiryDate: new Date("2027-02-01T00:00:00.000Z") });
  const quarantined = lot({ lotNumber: "HOLD", status: "QUARANTINED", expiryDate: new Date("2026-11-01T00:00:00.000Z") });
  const expired = lot({ lotNumber: "OLD", expiryDate: new Date("2026-10-20T00:00:00.000Z") });

  assert.equal(canUseLot(quarantined, now), false);
  assert.equal(canUseLot(expired, now), false);
  assert.equal(fefoLot([later, quarantined, earlier, expired], now)?.lotNumber, "EARLIER");
});

test("expiry alerts respect the configured lookahead window", () => {
  const now = new Date("2026-10-23T12:00:00.000Z");
  assert.equal(expiringWithinDays(lot({ expiryDate: new Date("2026-11-20T00:00:00.000Z") }), 30, now), true);
  assert.equal(expiringWithinDays(lot({ expiryDate: new Date("2027-01-01T00:00:00.000Z") }), 30, now), false);
});
