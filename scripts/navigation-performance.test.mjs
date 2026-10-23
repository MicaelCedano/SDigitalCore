import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const requireReal = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const admin = { id: "admin-test", roleCode: "ADMIN", status: "ACTIVE", allowedModules: [] };
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function memoize(fn) {
  const calls = new Map();
  return (...args) => { const key = JSON.stringify(args); if (!calls.has(key)) calls.set(key, fn(...args)); return calls.get(key); };
}

function environment({ actor = admin, wallet, audits = [] } = {}) {
  const calls = [];
  const prisma = new Proxy({}, { get: (_, model) => new Proxy({}, { get: (_target, operation) => async args => {
    calls.push({ model, operation, args });
    if (model === "priceListItem") throw new Error("Retired price list was queried");
    if (model === "wallet" && operation === "findUnique") return wallet ? wallet.promise : { balance: { toFixed: () => "100.00" } };
    if (model === "user" && operation === "findFirst") return actor;
    if (operation === "count") return 2;
    if (operation === "aggregate") return { _count: { _all: 3 }, _sum: { total: 125 } };
    if (model === "auditLog") return audits;
    if (model === "qcRevisionBatch" && args.where.id) return [{ id: "batch-test", batchNumber: "QC-TEST", supplierName: "Demo" }];
    if (operation === "findMany" || operation === "groupBy") return [];
    return null;
  } }) });
  const modules = new Map();
  const helpers = {
    requireUser: async () => { if (!actor) throw new Error("UNAUTHENTICATED"); return { id: actor.id, name: "Demo", email: "demo@example.test" }; },
    getPersistedCurrentUser: memoize(async () => actor),
  };
  function load(relative) {
    if (modules.has(relative)) return modules.get(relative);
    const module = { exports: {} }; modules.set(relative, module.exports);
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const requireMock = id => {
      if (id === "server-only") return {};
      if (id === "react") return { cache: memoize };
      if (id === "react/jsx-runtime") return requireReal(id);
      if (id === "@/lib/db/prisma") return { prisma };
      if (id === "@/lib/auth/helpers") return helpers;
      if (id === "@/lib/auth/config") return { auth: async () => actor ? { user: { id: actor.id } } : null };
      if (id === "next/navigation") return { redirect: () => { throw new Error("UNAUTHENTICATED"); } };
      if (id === "@/components/layout/DashboardLayoutClient") return { DashboardLayoutClient: () => null };
      if (id.startsWith("@/lib/dashboard/")) return load(`${id.slice(2)}.ts`);
      if (id === "./admin-operations") return load("lib/dashboard/admin-operations.ts");
      throw new Error(`Unrecognized dependency: ${id}`);
    };
    new Function("require", "module", "exports", code)(requireMock, module, module.exports);
    modules.set(relative, module.exports);
    return module.exports;
  }
  return { load, calls };
}

// A pending wallet must not hold back the authenticated module layout.
{
  const wallet = deferred(); const env = environment({ wallet });
  const layout = env.load("app/(dashboard)/layout.tsx").default;
  let rendered;
  const pending = layout({ children: "MODULE CONTENT" }).then(value => { rendered = value; });
  await new Promise(setImmediate);
  assert.ok(rendered, "Module layout blocked on optional header queries");
  assert.equal(rendered.props.children, "MODULE CONTENT");
  assert.ok(rendered.props.headerSummary instanceof Promise);
  wallet.resolve({ balance: { toFixed: () => "100.00" } });
  await pending;
  assert.deepEqual(await rendered.props.headerSummary, { walletBalance: "100.00", notificationCount: 6 });
}

// Header and dashboard share request-local counter reads. Empty QC lookups do no extra work.
{
  const env = environment();
  const header = env.load("lib/dashboard/header-summary.ts").getDashboardHeaderSummary;
  const overview = env.load("lib/dashboard/admin-operations.ts").getAdminOperationsOverview;
  await Promise.all([header(admin.id, true), overview(admin.id)]);
  for (const model of ["warehouseRequest", "accessRequest", "qcImeiRequest"]) {
    assert.equal(env.calls.filter(call => call.model === model && call.operation === "count").length, 1);
  }
  assert.equal(env.calls.filter(call => call.model === "user" && call.operation === "findUnique").length, 0);
  assert.equal(env.calls.filter(call => call.model === "qcRevisionBatch").length, 1);
  assert.equal(env.calls.filter(call => call.model === "walletLedgerEntry").length, 1);
}

// Non-empty QC history still executes the original paid-credit check.
{
  const env = environment({ audits: [{ entityId: "batch-test", action: "qc_batch.assignment_submit", createdAt: new Date(), afterData: { reviewerId: "qc-test", reviewerName: "QC Demo", reviewedDevices: 1, assignedDevices: 1 } }] });
  const result = await env.load("lib/dashboard/admin-operations.ts").getAdminOperationsOverview(admin.id);
  const payment = env.calls.find(call => call.model === "walletLedgerEntry" && call.args.where.externalKey);
  assert.equal(payment.args.where.type, "CREDIT");
  assert.equal(payment.args.where.status, "POSTED");
  assert.equal(result.qcSubmittedPendingTotal, 50);
}

// Wrong actors cannot obtain an admin overview, and non-admin headers skip admin counters.
for (const actor of [null, { ...admin, status: "BLOCKED" }, { ...admin, roleCode: "QC" }]) {
  const env = environment({ actor });
  assert.equal(await env.load("lib/dashboard/admin-operations.ts").getAdminOperationsOverview(admin.id), null);
  assert.equal(env.calls.length, 0);
}
{
  const env = environment();
  assert.equal(await env.load("lib/dashboard/admin-operations.ts").getAdminOperationsOverview("someone-else"), null);
  await env.load("lib/dashboard/header-summary.ts").getDashboardHeaderSummary("qc-test", false);
  assert.equal(env.calls.length, 1); assert.equal(env.calls[0].args.where.userId, "qc-test");
}

// Sales retain invoice totals and never fetch the retired price list.
{
  const env = environment();
  const overview = env.load("lib/dashboard/user-operations.ts").getUserOperationsOverview;
  const sales = await overview("sales-test", ["facturas"], "VENTAS");
  assert.equal(sales.sales.invoicesCountToday, 3); assert.equal(sales.sales.totalAmountToday, 125);
  assert.equal(env.calls.filter(call => call.model === "priceListItem").length, 0);
  assert.equal((await overview("legacy-test", ["precios"], "PERSONALIZADO")).sales, undefined);
}
{
  const env = environment();
  const permissions = env.load("lib/auth/helpers.ts");
  assert.equal(await permissions.can("precios.write"), false);
  assert.equal(await permissions.can("prices.read"), false);
  assert.equal(await permissions.can("qc.read"), true);
  const roles = env.load("lib/auth/roles-permissions.ts");
  assert.equal(roles.SYSTEM_MODULES.some(module => module.key === "precios"), false);
  assert.ok(Object.values(roles.DEFAULT_ROLE_MODULES).every(modules => !modules.includes("precios")));
}
console.log("Navigation: streaming, shared counts, actor isolation, QC payment reads and retired prices passed (no database connection).");
