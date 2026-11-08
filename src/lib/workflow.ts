export type TestStatus = "Pending" | "In Progress" | "Awaiting Review" | "Completed";
export type TestAction = "save" | "submit" | "complete";

const transitions: Record<TestAction, Partial<Record<TestStatus, TestStatus>>> = {
  save: { Pending: "In Progress", "In Progress": "In Progress", "Awaiting Review": "In Progress", Completed: "In Progress" },
  submit: { "In Progress": "Awaiting Review" },
  complete: { "Awaiting Review": "Completed" },
};

export function nextTestStatus(action: TestAction, current: TestStatus): TestStatus | null {
  return transitions[action][current] ?? null;
}

export function overallOrderStatus(statuses: TestStatus[]): TestStatus {
  if (statuses.length > 0 && statuses.every((status) => status === "Completed")) return "Completed";
  if (statuses.includes("Awaiting Review")) return "Awaiting Review";
  if (statuses.includes("In Progress")) return "In Progress";
  return "Pending";
}