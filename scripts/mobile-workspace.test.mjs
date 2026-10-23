import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import { z } from 'zod';

async function load(path, dependencies = {}) {
  const source = await fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const exports = {};
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  new Function('require', 'exports', outputText)(id => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
    return dependencies[id];
  }, exports);
  return exports;
}
const contract = await load('lib/mobile/workspace-contract.ts');
const permissions = { qc: 'qc.read', almacen: 'warehouse.read', recibos: 'warehouse.read', garantias: 'warranties.read', reparaciones: 'reparaciones.read', desbloqueos: 'desbloqueos.read', 'centro-trabajo': 'centro-trabajo.read', facturas: 'facturas.read', wallet: 'wallet.read', configuracion: 'settings.read' };
async function request(actor, allowed, search = '', failure = false) {
  const calls = [];
  const route = await load('app/api/mobile/workspace/route.ts', {
    'zod': { z }, 'next/server': { NextResponse: { json: Response.json } },
    '@/lib/auth/helpers': { getPersistedCurrentUser: async () => actor, can: async permission => allowed.includes(permission) },
    '@/lib/mobile/workspace-contract': contract,
    '@/lib/mobile/workspace-data': { WORKSPACE_PERMISSIONS: permissions, readWorkspaceModule: async (...args) => { calls.push(args); if (failure) throw new Error('PRIVATE INTERNAL DETAIL'); return { entries: [] }; } },
  });
  const response = await route.GET(new Request(`https://core.example/api/mobile/workspace${search}`));
  return { status: response.status, data: await response.json(), calls, cache: response.headers.get('Cache-Control') };
}
const actor = { id: 'employee', roleCode: 'QC', status: 'ACTIVE' };
for (const user of [null, { ...actor, status: 'BLOCKED' }, { ...actor, status: 'INACTIVE' }]) {
  const result = await request(user, Object.values(permissions), '?module=wallet');
  assert.equal(result.status, 401); assert.equal(result.calls.length, 0);
}
const catalog = await request(actor, ['qc.read', 'wallet.read']);
assert.deepEqual(catalog.data.modules.map(definition => definition.key), ['qc', 'wallet']);
assert.match(catalog.cache, /no-store/);
assert.equal((await request(actor, [], '?module=almacen')).status, 403);
for (const query of ['?module=precios', '?module=unknown', '?module=wallet&page=0', '?module=wallet&page=1001', `?module=wallet&q=${'x'.repeat(81)}`]) {
  const result = await request(actor, ['wallet.read'], query);
  assert.equal(result.status, 400); assert.equal(result.calls.length, 0);
}
const valid = await request(actor, ['warehouse.read'], '?module=recibos&q=Samsung%20A17&page=2');
assert.equal(valid.status, 200); assert.deepEqual(valid.calls[0], ['recibos', 'Samsung A17', 2, actor]);
const failed = await request(actor, ['wallet.read'], '?module=wallet', true);
assert.equal(failed.status, 503); assert.doesNotMatch(JSON.stringify(failed.data), /PRIVATE/);

const calls = [];
const fixture = { id: 'test', createdAt: '2026-10-23T12:00:00Z', status: 'ACTIVE', name: 'Samsung A17', code: 'A17', totalUnits: 24, boxes: 2, unitsPerBox: 10, looseUnits: 4 };
const success = value => ({ success: true, data: value });
const method = (name, value) => async (...args) => { calls.push({ name, args }); return value; };
const dependencies = {
  './workspace-contract': contract,
  '@/modules/almacen/actions/warehouse': { getWarehouseProductsAction: method('stock', success([fixture])) },
  '@/modules/almacen/actions/goods-receipt': { getGoodsReceiptsAction: method('receipts', success([{ ...fixture, receiptNumber: 'REC-1', items: [{ description: 'Samsung A17', imeiOrSerial: '000000000000001', quantity: 2 }] }])) },
  '@/modules/garantias/actions/warranty': { listWarrantyCases: method('warranties', success({ cases: [{ ...fixture, model: 'A17', problem: 'Nota original', imei: '000000000000001' }], total: 41 })) },
  '@/modules/reparaciones/actions/repairs': { getPendingRepairJobsAction: method('adminRepairs', success([{ ...fixture, jobCode: 'REP-1', items: [] }])), getRepairDashboardAction: method('myRepairs', success({ data: { queue: [], myJobs: [{ ...fixture, jobCode: 'REP-2' }] } })) },
  '@/modules/desbloqueos/actions/unlocks': { getUnlockRequestsAction: method('unlocks', success([{ ...fixture, requestCode: 'DES-1', model: 'A17', imeis: ['000000000000001'], adminObservation: 'Respuesta original' }])) },
  '@/modules/facturas/actions/invoice': { getInvoicesAction: method('invoices', success([{ ...fixture, invoiceNumber: 'CND-1', type: 'CONDUCE', total: 999999, items: [{ description: 'A17', quantity: 2, totalPrice: 888888, imeis: '000000000000001' }] }])) },
  '@/modules/qc/actions/revision-batch': { getRevisionBatchesAction: method('batches', success([{ ...fixture, batchNumber: 'LOT-1' }])), getQcDashboardAction: method('myQc', success({ devices: [{ ...fixture, model: 'A17', imei: '000000000000001' }], stats: { asignados: 1, pendientes: 1, revisadosHoy: 0 } })) },
  '@/modules/centro-trabajo/data': { getWorkCenterData: method('work', { schemaReady: true, tasks: [{ ...fixture, title: 'Tarea', progressDone: 3, progressTotal: 5 }], historyTasks: [], metrics: { action: 1, overdue: 0 } }) },
  '@/modules/wallet/data': { getCurrentWallet: method('wallet', { schemaReady: true, wallet: { balance: '10.00', owner: 'Mi cuenta', accounts: [], entries: [{ id: 'ledger', amount: '10.00', type: 'CREDIT', secureToken: 'DO-NOT-EXPOSE', occurredAt: '2026-10-23T12:00:00Z' }] }, legacyHistory: [] }) },
  '@/modules/configuracion/actions/branch': { getBranchesAction: method('branches', success([fixture])) },
};
const { readWorkspaceModule } = await load('lib/mobile/workspace-data.ts', dependencies);
for (const definition of contract.WORKSPACE_MODULES) {
  const result = await readWorkspaceModule(definition.key, '', 1, actor);
  assert.equal(result.module, definition.key); assert.ok(result.entries.length); assert.equal(result.page, 1);
  assert.doesNotMatch(JSON.stringify(result), /DO-NOT-EXPOSE/);
  if (definition.key === 'wallet') assert.deepEqual(calls.find(call => call.name === 'wallet').args, [{ provision: false }]);
  if (definition.key === 'centro-trabajo') {
    assert.deepEqual(calls.find(call => call.name === 'work').args, [{ syncQc: false }]);
    assert.equal(result.entries[0].fields.find(field => field.label === 'Avance').value, '3 / 5');
  }
  if (definition.key === 'facturas') assert.doesNotMatch(JSON.stringify(result), /999999|888888/);
  if (definition.key === 'recibos') assert.match(JSON.stringify(result), /000000000000001/);
  if (definition.key === 'garantias') assert.equal(result.hasMore, true);
}
await readWorkspaceModule('reparaciones', '', 1, { roleCode: 'ADMIN' });
assert.equal(calls.filter(call => call.name === 'adminRepairs').length, 1);
assert.equal(calls.filter(call => call.name === 'myRepairs').length, 1);
assert.equal((await readWorkspaceModule('almacen', 'no existe', 1, actor)).entries.length, 0);
assert.deepEqual(calls.find(call => call.name === 'stock').args, ['', { limit: 100 }]);

// Exercise real data readers: the GET variants must never provision or synchronize.
let writes = 0;
const queries = [];
const prisma = {
  wallet: { findUnique: async () => null, create: async () => { writes++; } },
  walletAccount: { create: async () => { writes++; } },
  legacyUserIdentity: { findFirst: async () => null },
  user: { findUnique: async () => ({ ...actor, allowedModules: ['centro-trabajo', 'qc'] }), findMany: async () => [] },
  workTask: { findMany: async args => { queries.push(args); return []; }, count: async () => 0 },
};
const auth = { requirePermission: async () => actor, requireUser: async () => actor, getPersistedCurrentUser: async () => actor };
const walletReader = await load('modules/wallet/data.ts', { '@/lib/db/prisma': { prisma }, '@/lib/auth/helpers': auth, '@/lib/wallet/eligibility': { WALLET_ELIGIBLE_USER_FILTER: {} } });
await walletReader.getCurrentWallet({ provision: false });
assert.equal(writes, 0);
const workReader = await load('modules/centro-trabajo/data.ts', {
  '@/lib/db/prisma': { prisma }, '@/lib/auth/helpers': auth, '@/modules/centro-trabajo/integrations/qc': { syncQcWorkTasks: async () => { writes++; } },
  'next/cache': { revalidatePath: () => { writes++; } }, 'next/server': { after: callback => callback() },
});
await workReader.getWorkCenterData({ syncQc: false });
assert.equal(writes, 0);
assert.ok(queries[0].where.AND[0].OR.some(rule => rule.creatorId === actor.id));
assert.ok(queries[0].where.OR.some(rule => rule.status));
console.log('Mobile workspace: 10 module adapters, session/permission gates, no-store, pagination, safe projections, role scopes and read-only data readers passed.');
