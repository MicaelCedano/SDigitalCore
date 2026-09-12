import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/utils/business-date.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);

const { businessDateInputToDate, formatBusinessDateInput, isValidDateInput } = mod.exports;
assert.equal(isValidDateInput("2026-09-12"), true);
assert.equal(isValidDateInput("2026-02-30"), false);
assert.equal(isValidDateInput("12/09/2026"), false);
assert.equal(formatBusinessDateInput(businessDateInputToDate("2026-09-12")), "2026-09-12");
assert.throws(() => businessDateInputToDate("2026-02-30"), /no es válida/);
console.log("Goods receipt date tests passed");
