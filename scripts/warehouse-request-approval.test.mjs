import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import { z } from "zod";

const source = fs.readFileSync("modules/almacen/lib/warehouse-request-status.ts", "utf8");
const action = source.slice(source.indexOf("const inputSchema"));
const js = ts.transpileModule(action, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

async function run({ claimed = 1, status = "APPROVED", stock = 100, notifyFails = false } = {}) {
  const calls = { stock: 0, moves: 0, audit: 0 };
  const items = Array.from({ length: 33 }, (_, i) => ({ productId: String(i), unitsCount: 2 }));
  const tx = {
    warehouseRequest: {
      updateMany: async () => ({ count: claimed }),
      findUnique: async () => ({ id: "r", status, items, type: "EXIT", requestCode: "SOL", title: "Test", details: null }),
    },
    auditLog: { create: async () => { calls.audit += 1; } },
    warehouseProduct: {
      findMany: async () => items.map((item) => ({
        id: item.productId,
        code: item.productId,
        name: "Test",
        color: "",
        boxes: 0,
        looseUnits: stock,
        totalUnits: stock,
        unitsPerBox: 1,
        status: "ACTIVE",
      })),
    },
    warehouseMovement: { createMany: async ({ data }) => { calls.moves = data.length; } },
  };
  const prisma = {
    $transaction: async (fn, options) => {
      assert.equal(options.timeout, 30000);
      return fn(tx);
    },
    warehouseRequest: {
      findUnique: async () => {
        if (notifyFails) throw new Error("notification");
        return null;
      },
    },
    user: { findMany: async () => [] },
  };
  const mod = { exports: {} };
  new Function(
    "exports",
    "prisma",
    "z",
    "parseRequestLine",
    "resolveMovementLine",
    "availableQuantity",
    "applyStockDelta",
    "sendPushToUsers",
    "revalidatePath",
    "console",
    js,
  )(
    mod.exports,
    prisma,
    z,
    () => ({ measure: "UNITS", quantity: 2 }),
    () => ({ measure: "UNITS", quantity: 2, unitsCount: 2, boxesCount: 0 }),
    (product) => product.looseUnits,
    async () => { calls.stock += 1; },
    async () => {},
    () => {},
    { error() {} },
  );
  try {
    await mod.exports.updateWarehouseRequestStatus({ id: "r", status, actorId: "admin", source: "web" });
    return { result: { success: true }, calls };
  } catch (error) {
    return { result: { success: false, error: error instanceof Error ? error.message : String(error) }, calls };
  }
}

let report = await run();
assert.equal(report.result.success, true);
assert.equal(report.calls.stock, 33);
assert.equal(report.calls.moves, 33);
assert.equal(report.calls.audit, 1);
report = await run({ claimed: 0 });
assert.equal(report.result.success, false);
assert.equal(report.calls.stock, 0);
report = await run({ status: "REJECTED" });
assert.equal(report.result.success, true);
assert.equal(report.calls.stock, 0);
report = await run({ stock: 1 });
assert.equal(report.result.success, false);
assert.match(report.result.error, /Stock insuficiente/);
report = await run({ notifyFails: true });
assert.equal(report.result.success, true);
report = await run({ status: "INVALID" });
assert.equal(report.result.success, false);
assert.equal(report.calls.stock, 0);
console.log("Warehouse approval: 33 lines, duplicate claim, rejection, insufficient stock, notification failure and invalid status passed.");
