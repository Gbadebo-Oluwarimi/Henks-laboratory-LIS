import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogueDepartmentDefaults,
  hasRowSpecificDepartmentMapping,
  normalizeDepartmentName,
  recommendedDepartmentCode,
} from "@/lib/department-catalogue";

test("department defaults distinguish performing departments from profile groups", () => {
  assert.equal(catalogueDepartmentDefaults.filter((item) => item.kind === "PERFORMING").length, 11);
  assert.equal(catalogueDepartmentDefaults.find((item) => item.code === "ANC-GROUP")?.kind, "ORDER_GROUP");
  assert.equal(catalogueDepartmentDefaults.some((item) => item.name === "Point-of-Care Testing"), false);
});

test("department matching normalizes spelling and punctuation", () => {
  assert.equal(normalizeDepartmentName("Haematology & Coagulation"), "haematology coagulation");
});

test("antenatal and point-of-care components route to their performing disciplines", () => {
  assert.equal(recommendedDepartmentCode({ sourceCode: "ANC-001", category: "Antenatal & Prenatal" }), "ANC-GROUP");
  assert.equal(recommendedDepartmentCode({ sourceCode: "ANC-004", category: "Antenatal & Prenatal" }), "BB");
  assert.equal(recommendedDepartmentCode({ sourceCode: "POC-005", category: "Point-of-Care Testing" }), "PAR");
  assert.equal(hasRowSpecificDepartmentMapping("POC-005"), true);
  assert.equal(hasRowSpecificDepartmentMapping("HEM-003"), false);
});
