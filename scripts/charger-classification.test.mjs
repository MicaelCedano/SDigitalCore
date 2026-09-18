import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../modules/facturas/lib/charger-classification.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const exports = {};

vm.runInNewContext(compiled, {
  exports,
  console,
});

const { classifyCharger } = exports;

assert.equal(classifyCharger("CELULAR APPLE IPHONE 11 128GB"), "TPC_LIGHTNING_20W");
assert.equal(classifyCharger("CELULAR APPLE IPHONE 12 128GB"), "TPC_LIGHTNING_20W");
assert.equal(classifyCharger("CELULAR APPLE IPHONE SE 64GB"), "TPC_LIGHTNING_20W");
assert.equal(classifyCharger("CELULAR APPLE IPHONE 13 PRO 256GB"), "TPC_LIGHTNING_33W");
assert.equal(classifyCharger("CELULAR APPLE IPHONE 14 128GB"), "TPC_LIGHTNING_33W");
assert.equal(classifyCharger("CELULAR APPLE IPHONE 15 128GB"), "TPC_TPC_33W");

assert.ok(!source.includes("USB_LIGHTNING_10W"), "La categoría descartada no debe seguir en la clasificación");
console.log("Charger classification sends former 10W models to TPC-Lightning 20W");
