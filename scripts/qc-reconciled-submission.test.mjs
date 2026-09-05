import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../modules/qc/lib/reconciled-submission.ts", import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { isReconciledSubmission } = exports;
const repairs = [{ entityId: "original", createdAt: new Date("2026-09-04"), afterData: { duplicateBatchId: "duplicate", reviewerId: "alberto", devicesMoved: 32, amount: 1600, paidReviewers: 1 } }];
const submission = { entityId: "original", createdAt: new Date("2026-09-03"), afterData: { reviewerId: "alberto", reviewedDevices: 32 } };
assert.equal(isReconciledSubmission(submission, repairs), true);
assert.equal(isReconciledSubmission({ ...submission, entityId: "duplicate" }, repairs), true);
assert.equal(isReconciledSubmission({ ...submission, entityId: "unrelated" }, repairs), false);
assert.equal(isReconciledSubmission({ ...submission, createdAt: new Date("2026-09-05") }, repairs), false);
assert.equal(isReconciledSubmission({ ...submission, afterData: { reviewerId: "other", reviewedDevices: 32 } }, repairs), false);
assert.equal(isReconciledSubmission({ ...submission, afterData: { reviewerId: "alberto", reviewedDevices: 25 } }, repairs), false);
assert.equal(isReconciledSubmission(submission, []), false);
console.log("QC reconciliation: original and duplicate paid submissions excluded; unrelated and later submissions preserved.");
