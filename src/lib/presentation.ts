import type { TestStatus } from "@/lib/workflow";

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export function splitPatientName(fullName: string): { surname: string; otherNames: string } {
  const [surname = "", ...otherNames] = fullName.trim().split(/\s+/).filter(Boolean);
  return { surname, otherNames: otherNames.join(" ") };
}

export function ageFromDateOfBirth(
  dateOfBirth: string | undefined,
  asOfDate: string,
): { age: string; ageUnit: "days" | "months" | "years" } | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const reference = new Date(`${asOfDate}T00:00:00.000Z`);
  if (Number.isNaN(birth.valueOf()) || Number.isNaN(reference.valueOf()) || birth > reference) return null;
  if (birth.toISOString().slice(0, 10) !== dateOfBirth || reference.toISOString().slice(0, 10) !== asOfDate) return null;

  let years = reference.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = reference.getUTCMonth() < birth.getUTCMonth() ||
    (reference.getUTCMonth() === birth.getUTCMonth() && reference.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) years -= 1;
  if (years >= 1) return { age: String(years), ageUnit: "years" };

  let months = (reference.getUTCFullYear() - birth.getUTCFullYear()) * 12 + reference.getUTCMonth() - birth.getUTCMonth();
  if (reference.getUTCDate() < birth.getUTCDate()) months -= 1;
  if (months >= 1) return { age: String(months), ageUnit: "months" };

  const days = Math.floor((reference.valueOf() - birth.valueOf()) / 86_400_000);
  return { age: String(days), ageUnit: "days" };
}

export function statusClass(status: TestStatus): string {
  return `status-badge status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

export function pageError(code: string | undefined): string | null {
  if (!code) return null;
  const messages: Record<string, string> = {
    validation: "Check the required fields and try again.",
    save: "The record could not be saved. Please retry.",
    missing: "This record or test is no longer available.",
    forbidden: "Your account does not have permission to perform this action.",
    transition: "This action is not allowed for the current test status or your role.",
    "patient-required": "Choose a patient from the suggestions before creating an order.",
    "inactive-department": "One or more selected tests are assigned to an inactive department. Ask an administrator to update the catalogue.",
    "department-test-mismatch": "Each selected test must belong to one of the selected departments. Review the department and test selection.",
    "import-price-required": "An approved price is required for each imported test before it can be ordered.",
    "missing-test": "That test is no longer part of this order.",
    "test-not-approved": "Only an approved test can be deleted here.",
    "test-has-reagent-traceability": "This test has recorded reagent lot usage and cannot be removed from the order.",
    "qc-blocked": "Report authorization is blocked because a required QC control has no current passing run.",
    "rejected-specimen": "This test cannot be completed because its linked specimen was rejected.",
    "amendment-required": "Released results must be changed through the controlled amendment workflow.",
    "result-validation": "Results can contain up to 3,000 characters.",
    "report-details-validation": "Check the report fields and enter a valid date and age.",
    "amendment-unavailable": "This report is not released or lacks the release details needed to start an amendment.",
    "clinical-record-retained": "This record has released reports or specimen history and cannot be deleted.",
    "specimen-history": "This order has specimen records and cannot be deleted.",
    "has-reagent-traceability": "This record has reagent lot usage history and cannot be deleted.",
  };
  return messages[code] ?? "The request could not be completed.";
}
