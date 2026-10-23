import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
import { z } from "zod";

// Execute the actual handler with isolated auth/database adapters; never connects to a database.
const source = await fs.readFile(new URL("../app/api/search/imei/route.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const helperSource = await fs.readFile(new URL("../modules/qc/lib/reviewer-selection.ts", import.meta.url), "utf8");
const helper = {};
new Function("exports", ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(helper);
const fixture = {
  id: "inspection-test", result: "NON_FUNCTIONAL", reviewedAt: new Date("2026-10-23T14:30:00Z"),
  createdAt: new Date("2026-10-23T14:00:00Z"), reviewerNameSnapshot: "Revisor de prueba",
  deviceId: "device-test", reviewerId: "employee-test", reviewer: { roleCode: "ALMACEN" },
  functionalityNotes: "Pantalla con rayas.\nNo borrar la nota original.",
  physicalNotes: "Golpe en la esquina.", grade: "B", batteryHealth: 0,
  device: { id: "device-test", imei: "000000000000004", model: "A17", brand: "Samsung", batch: { batchNumber: "QC-TEST", supplierName: "Suplidor de prueba" } },
};

async function run(user, rows = [fixture], query = "000000000000004", historyRows = []) {
  const calls = [];
  const prisma = Object.fromEntries([
    "warrantyCase", "goodsReceiptItem", "stockCountItem", "invoiceItem", "qcInspection", "deviceUnit", "repairJobItem", "unlockRecord",
  ].map(model => [model, { findMany: async args => {
    calls.push({ model, args });
    return model === "qcInspection" ? (args.where.deviceId ? historyRows : rows) : [];
  } }]));
  const exports = {};
  const requireMock = id => {
    if (id === "next/server") return { NextResponse: { json: (data, options) => Response.json(data, options) } };
    if (id === "zod") return { z };
    if (id === "@/lib/auth/helpers") return { getPersistedCurrentUser: async () => user };
    if (id === "@/lib/db/prisma") return { prisma };
    if (id === "@/modules/qc/lib/reviewer-selection") return helper;
    throw new Error(`Unexpected dependency: ${id}`);
  };
  new Function("require", "exports", outputText)(requireMock, exports);
  const response = await exports.GET(new Request(`https://core.example/api/search/imei?q=${encodeURIComponent(query)}`));
  return { status: response.status, data: await response.json(), calls, cache: response.headers.get("Cache-Control") };
}

for (const user of [null, { status: "INACTIVE", roleCode: "ADMIN", allowedModules: [] }]) {
  const result = await run(user);
  assert.equal(result.status, 401);
  assert.equal(result.calls.length, 0);
}
const forbidden = await run({ status: "ACTIVE", roleCode: "EMPLOYEE", allowedModules: [] });
assert.equal(forbidden.data.results.length, 0);
assert.equal(forbidden.calls.length, 0, "QC records must not be queried without QC access");

for (const user of [
  { status: "ACTIVE", roleCode: "EMPLOYEE", allowedModules: ["qc"] },
  { status: "ACTIVE", roleCode: "ADMIN", allowedModules: [] },
]) {
  const result = await run(user);
  assert.equal(result.status, 200);
  assert.equal(result.cache, "no-store");
  const item = result.data.results[0];
  assert.equal(item.imei, "000000000000004");
  assert.equal(item.source, "qc");
  assert.equal(item.status, "NON_FUNCTIONAL");
  assert.deepEqual(item.qcReview, {
    reviewerName: fixture.reviewerNameSnapshot, reviewedAt: fixture.reviewedAt.toISOString(),
    functionalityNotes: fixture.functionalityNotes, physicalNotes: fixture.physicalNotes,
    grade: "B", batteryHealth: 0,
  });
  assert.equal("reviewerId" in item.qcReview, false);
  const qcCall = result.calls.find(call => call.model === "qcInspection");
  assert.equal(qcCall.args.where.status, "COMPLETED");
  assert.deepEqual(qcCall.args.where.corrections, { none: {} });
  assert.equal(qcCall.args.select.functionalityNotes, true);
  assert.equal(qcCall.args.select.physicalNotes, true);
  assert.equal(result.calls.filter(call => call.model === "qcInspection").length, 1, "Ordinary QC searches need no history query");
}
const absent = await run({ status: "ACTIVE", roleCode: "ADMIN", allowedModules: [] }, [{ ...fixture, reviewedAt: null, functionalityNotes: null, physicalNotes: null, grade: null, batteryHealth: null }]);
assert.equal(absent.data.results[0].qcReview.functionalityNotes, null);
assert.equal(absent.data.results[0].qcReview.reviewedAt, null);
const invalid = await run({ status: "ACTIVE", roleCode: "ADMIN", allowedModules: [] }, [], "12");
assert.equal(invalid.status, 400);
assert.equal(invalid.calls.length, 0);

// Regression: an administrator marks an employee-reviewed device functional.
// Keep the current result while attributing QC and its original notes to the employee.
const admin = { status: "ACTIVE", roleCode: "ADMIN", allowedModules: [] };
const employeeInspection = {
  ...fixture, reviewerNameSnapshot: "Alejandro peralta", reviewedAt: new Date("2026-10-04T00:19:12.170Z"),
  functionalityNotes: "housing rayado cristal de la camara rayado bocina de arriba floja bandeja sim no entra bien",
  physicalNotes: null,
  device: { ...fixture.device, imei: "355939491464574" },
};
const adminCheck = {
  ...employeeInspection, id: "admin-check", result: "FUNCTIONAL", reviewerId: "admin-test",
  reviewerNameSnapshot: "Micael Cedano", reviewer: { roleCode: "ADMIN" },
  reviewedAt: new Date("2026-10-06T22:42:43.595Z"),
  functionalityNotes: "Marcado funcional por administración (verificación física)",
};
const corrected = await run(admin, [adminCheck], "355939491464574", [adminCheck, employeeInspection]);
assert.equal(corrected.data.results.length, 1);
const correctedItem = corrected.data.results[0];
assert.equal(correctedItem.status, "FUNCTIONAL");
assert.equal(correctedItem.date, adminCheck.reviewedAt.toISOString());
assert.match(correctedItem.detail, /Revisado por Alejandro peralta/);
assert.doesNotMatch(correctedItem.detail, /Micael/);
assert.equal(correctedItem.qcReview.reviewerName, employeeInspection.reviewerNameSnapshot);
assert.equal(correctedItem.qcReview.reviewedAt, employeeInspection.reviewedAt.toISOString());
assert.equal(correctedItem.qcReview.functionalityNotes, employeeInspection.functionalityNotes);
assert.equal(correctedItem.qcReview.physicalNotes, null);
assert.equal("reviewerId" in correctedItem.qcReview, false);
const historyQuery = corrected.calls.filter(call => call.model === "qcInspection")[1].args;
assert.deepEqual(historyQuery.where, { status: "COMPLETED", deviceId: { in: ["device-test"] } });
assert.equal("corrections" in historyQuery.where, false, "The superseded employee review must remain eligible");
assert.equal(historyQuery.orderBy[0].reviewedAt.nulls, "last");

// A genuine subsequent employee correction is the reviewer, including warehouse employees.
const newerEmployee = { ...employeeInspection, reviewerNameSnapshot: "Otro revisor", reviewedAt: new Date("2026-10-05T00:00:00Z") };
const correctedAgain = await run(admin, [adminCheck], "355939491464574", [adminCheck, newerEmployee, employeeInspection]);
assert.equal(correctedAgain.data.results[0].qcReview.reviewerName, "Otro revisor");
for (const check of [
  adminCheck,
  { ...adminCheck, reviewerId: null, reviewer: null, reviewerNameSnapshot: " ADMINISTRACIÓN ", functionalityNotes: null },
  { ...adminCheck, reviewer: { roleCode: "SUPERVISOR" } },
]) {
  const onlyAdmin = await run(admin, [check], "355939491464574", [check]);
  assert.equal(onlyAdmin.data.results[0].status, "FUNCTIONAL");
  assert.equal(onlyAdmin.data.results[0].qcReview, null);
  assert.match(onlyAdmin.data.results[0].detail, /Sin revisión QC registrada/);
}
const forbiddenHistory = await run({ status: "ACTIVE", roleCode: "EMPLOYEE", allowedModules: [] }, [adminCheck], "355939491464574", [employeeInspection]);
assert.equal(forbiddenHistory.calls.length, 0);
console.log("IMEI QC details: auth, permissions, original notes, nullable fields, administrative recovery and original reviewer passed.");
