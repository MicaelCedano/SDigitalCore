import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const source = fs.readFileSync(new URL("../lib/validation/goods-receipt.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function("require", "module", "exports", compiled)(createRequire(import.meta.url), mod, mod.exports);
const { validateWarehouseSelection, goodsReceiptWarehouseImportSchema } = mod.exports;
const items = [{ id: "a", quantity: 10, colorVariants: [{ quantity: 6 }, { quantity: 4 }] }, { id: "b", quantity: 3, colorVariants: null }];
const line = { itemId: "a", variantIndex: 0, quantity: 2, code: "A", name: "Modelo", unitsPerBox: 1 };
assert.doesNotThrow(() => validateWarehouseSelection(items, [line]));
assert.doesNotThrow(() => validateWarehouseSelection(items, [line, { ...line, variantIndex: 1, quantity: 4 }]));
assert.doesNotThrow(() => validateWarehouseSelection(items, [{ ...line, itemId: "b", quantity: 3 }]));
for (const lines of [[{ ...line, quantity: 7 }], [line, line], [{ ...line, itemId: "otro" }], [{ ...line, variantIndex: 5 }], [{ ...line, quantity: 0 }], [{ ...line, quantity: 1.5 }]]) {
  assert.throws(() => validateWarehouseSelection(items, lines));
}
assert.equal(goodsReceiptWarehouseImportSchema.safeParse({ receiptId: "r", lines: [] }).success, false);
assert.equal(goodsReceiptWarehouseImportSchema.safeParse({ receiptId: "r", lines: [line] }).success, true);
console.log("Goods receipt selection tests passed");
