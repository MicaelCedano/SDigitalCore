import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatMigrationLayoutErrors, inspectMigrationLayout } from "./check-migration-layout.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("registra todos los SQL históricos fuera del flujo Prisma", async () => {
  const report = await inspectMigrationLayout(projectRoot);
  assert.deepEqual(formatMigrationLayoutErrors(report), []);
  assert.equal(report.bareSqlFiles.length, 13);
  assert.equal(report.invalidDirectories.length, 0);
  assert.equal(report.manualMigrationStatus, "requires-production-reconciliation");
});
