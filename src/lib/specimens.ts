import type { SpecimenStatus } from "@/lib/models";

const transitions: Partial<Record<SpecimenStatus, SpecimenStatus[]>> = {
  ORDERED: ["COLLECTED", "CANCELLED"],
  COLLECTED: ["RECEIVED", "REJECTED"],
  RECEIVED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["IN_PROCESS", "RECOLLECTION_REQUIRED"],
  IN_PROCESS: ["COMPLETED", "RECOLLECTION_REQUIRED"],
  REJECTED: ["RECOLLECTION_REQUIRED", "CANCELLED"],
  RECOLLECTION_REQUIRED: ["CANCELLED"],
};

export function canTransitionSpecimen(from: SpecimenStatus, to: SpecimenStatus): boolean {
  return transitions[from]?.includes(to) === true;
}

export function nextSpecimenStatuses(status: SpecimenStatus): SpecimenStatus[] {
  return transitions[status] ?? [];
}
