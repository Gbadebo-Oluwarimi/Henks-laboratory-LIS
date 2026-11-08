import type { LabOrder, OrderedTest, ReleasedReportVersion, UserRole } from "@/lib/models";

export function buildReleasedReportVersion(
  order: LabOrder,
  tests: OrderedTest[],
  release: { at: Date; actorId: string; actorName: string; actorRole: UserRole },
): ReleasedReportVersion {
  const versions = order.reportVersions ?? [];
  return {
    version: (versions.at(-1)?.version ?? 0) + 1,
    accessionId: order.accessionId,
    releasedAt: release.at,
    releasedBy: release.actorId,
    releasedByName: release.actorName,
    releasedByRole: release.actorRole,
    patientSnapshot: order.clientSnapshot,
    ...(order.reportDetails ? { reportDetails: order.reportDetails } : {}),
    tests,
    ...(order.pendingAmendment?.reason ? { amendmentReason: order.pendingAmendment.reason } : {}),
  };
}
