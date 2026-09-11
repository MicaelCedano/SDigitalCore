import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/utils/format.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);

const { civilDateKey, formatCivilDateRD } = mod.exports;
const documentDate = new Date("2026-09-11T00:00:00.000Z");

assert.equal(civilDateKey(documentDate), "2026-09-11");
assert.equal(formatCivilDateRD(documentDate), "11/9/2026");

console.log("Warranty civil document dates keep their calendar day");
