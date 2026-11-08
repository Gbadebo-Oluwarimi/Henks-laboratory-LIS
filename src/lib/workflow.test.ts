import assert from "node:assert/strict";
import test from "node:test";
import { cataloguePanels, catalogueTests, hasSourceReference } from "@/lib/catalogue";
import { nextTestStatus, overallOrderStatus } from "@/lib/workflow";

test("catalogue preserves fixed source references without clinically approving them", () => {
  assert.equal(cataloguePanels.length, 33);
  assert.equal(catalogueTests.length, 161);
  assert.ok(catalogueTests.every((item) => item.referenceApproved === false));
  assert.equal(hasSourceReference(catalogueTests.find((item) => item.name === "WBC")?.sourceReference ?? ""), true);
  assert.equal(catalogueTests.find((item) => item.name === "ESR")?.sourceReference, "Male (0 - 10); Female (0 - 15)");
  assert.equal(hasSourceReference(catalogueTests.find((item) => item.name === "GGT")?.sourceReference ?? ""), false);
  assert.equal(hasSourceReference(catalogueTests.find((item) => item.name === "Pus cell")?.sourceReference ?? ""), false);
  assert.ok(catalogueTests.some((item) => item.name === "GGT" && item.sourceReference === "Norm ( )"));
  assert.ok(catalogueTests.some((item) => item.panel === "MCS Report" && item.name === "Sensitivity"));
  assert.ok(catalogueTests.filter((item) => item.panel === "Full Blood Count (FBC/CBC)").every((item) => !["C-Reactive protein (CRP)", "MP (Malaria Parasite) - Microscopy", "MP (Malaria Parasite) - RDT", "HBsAg", "HIV", "HCV"].includes(item.name)));
  assert.equal(catalogueTests.find((item) => item.name === "C-Reactive protein (CRP)")?.departmentCode, "CHEM");
  assert.deepEqual(catalogueTests.filter((item) => item.panel === "Microscopy/Bloodsmear(Malaria Parasite)").map((item) => item.name), ["RBC", "WBC", "PLT"]);
  assert.ok(catalogueTests.filter((item) => item.panel === "Microscopy/Bloodsmear(Malaria Parasite)").every((item) => item.departmentCode === "PAR"));
});

test("test statuses only allow explicit forward transitions", () => {
  assert.equal(nextTestStatus("save", "Pending"), "In Progress");
  assert.equal(nextTestStatus("save", "In Progress"), "In Progress");
  assert.equal(nextTestStatus("submit", "In Progress"), "Awaiting Review");
  assert.equal(nextTestStatus("complete", "Awaiting Review"), "Completed");
  assert.equal(nextTestStatus("complete", "In Progress"), null);
  assert.equal(nextTestStatus("submit", "Pending"), null);
  assert.equal(nextTestStatus("save", "Awaiting Review"), "In Progress");
  assert.equal(nextTestStatus("save", "Completed"), "In Progress");
});

test("order status reflects its test states without completing siblings", () => {
  assert.equal(overallOrderStatus(["Completed", "In Progress"]), "In Progress");
  assert.equal(overallOrderStatus(["Completed", "Awaiting Review"]), "Awaiting Review");
  assert.equal(overallOrderStatus(["Completed", "Completed"]), "Completed");
  assert.equal(overallOrderStatus(["Pending", "Pending"]), "Pending");
});
