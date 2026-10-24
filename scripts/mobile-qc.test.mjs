import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import { z } from 'zod';
import sharp from 'sharp';

async function load(path, dependencies = {}) {
  const source = await fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const exports = {};
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  new Function('require', 'exports', outputText)(id => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
    return dependencies[id];
  }, exports);
  return exports;
}
const contract = await load('lib/mobile/qc-contract.ts');
const validation = await load('lib/validation/revision-batch.ts', { zod: { z }, '@/lib/mobile/qc-contract': contract });
const { recordReview } = await load('modules/qc/lib/record-review.ts');
const actor = { id: 'qc-test', name: 'Revisor original', admin: false };
const batch = { id: 'lot-test', batchNumber: 'LOT-TEST-01', status: 'IN_REVIEW', createdAt: new Date('2026-10-01T00:00:00Z'), totalDevices: 1, reviewedDevices: 0 };
const device = { id: 'device-test', assignedToId: actor.id, batchId: batch.id, batch, updatedAt: new Date('2026-10-23T12:00:00Z') };
const command = { deviceId: device.id, result: 'FUNCTIONAL', grade: 'A', notes: 'Observación original', batteryHealth: 0,
  mobile: { commandId: '569076c2-dae2-4adc-908b-c339abdb8caf', expectedUpdatedAt: device.updatedAt.toISOString(), expectedBatchId: batch.id, checklist: contract.QC_CHECKLIST.map(item => item.id) } };
assert(validation.reviewDeviceSchema.safeParse(command).success);
assert(!validation.reviewDeviceSchema.safeParse({ ...command, mobile: { ...command.mobile, checklist: [] } }).success);
assert(validation.reviewDeviceSchema.safeParse({ ...command, result: 'NON_FUNCTIONAL', mobile: { ...command.mobile, checklist: [] } }).success);
assert(validation.reviewDeviceSchema.safeParse({ ...command, mobile: undefined }).success); // Existing web calls remain valid.
for (const invalid of [{ batteryHealth: 101 }, { batteryHealth: -1 }, { notes: 'x'.repeat(1001) }, { mobile: { ...command.mobile, commandId: 'not-a-uuid' } }])
  assert(!validation.reviewDeviceSchema.safeParse({ ...command, ...invalid }).success);

function database(overrides = {}) {
  let state = { device: structuredClone({ ...device, ...overrides }), inspections: [], audits: [], batch: structuredClone(batch) };
  const locks = []; let queue = Promise.resolve(); let failAudit = false;
  const tx = {
    $queryRaw: async (sql, id) => { locks.push([sql.join('?'), id]); },
    deviceUnit: {
      findUnique: async () => ({ ...state.device, batch: state.device.batch && state.batch }),
      update: async ({ data }) => { state.device = { ...state.device, ...data, updatedAt: new Date('2026-10-23T12:01:00Z') }; },
      findMany: async () => [{ ...state.device, inspections: state.inspections.filter(i => i.createdAt >= state.batch.createdAt).slice(-1).reverse() }],
    },
    qcInspection: {
      findUnique: async ({ where }) => state.inspections.find(i => i.sourceRecordId === where.sourceSystem_sourceRecordId.sourceRecordId) ?? null,
      findFirst: async ({ where }) => [...state.inspections].reverse().find(i => i.createdAt >= where.createdAt.gte && i.status === 'COMPLETED') ?? null,
      create: async ({ data }) => { const value = { ...data, id: `inspection-${state.inspections.length + 1}`, createdAt: new Date('2026-10-23T12:00:30Z') }; state.inspections.push(value); return value; },
    },
    qcRevisionBatch: { update: async ({ data }) => (state.batch = { ...state.batch, ...data }) },
    auditLog: { create: async ({ data }) => { if (failAudit) throw new Error('audit unavailable'); state.audits.push(data); } },
  };
  const db = { $transaction: work => {
    const next = queue.then(async () => { const snapshot = structuredClone(state); try { return await work(tx); } catch (error) { state = snapshot; throw error; } });
    queue = next.catch(() => {}); return next;
  } };
  return { db, get state() { return state; }, locks, failAudit: () => { failAudit = true; } };
}
const first = database();
const saved = await recordReview(first.db, actor, command);
assert.equal(saved.replayed, false);
assert.equal(first.state.inspections[0].reviewerNameSnapshot, 'Revisor original');
assert.equal(first.state.inspections[0].batteryHealth, 0);
assert.equal(first.state.inspections[0].functionalityNotes, command.notes);
assert.equal(first.state.batch.reviewedDevices, 1);
assert.equal(first.state.batch.status, 'IN_REVIEW'); // No automatic approval/payment.
assert.equal(first.state.audits.length, 1);
assert.match(first.locks[0][0], /qc_revision_batch.*FOR UPDATE/);
assert.match(first.locks[1][0], /device_unit.*FOR UPDATE/);
assert.equal((await recordReview(first.db, actor, command)).replayed, true);
assert.equal(first.state.inspections.length, 1); assert.equal(first.state.audits.length, 1);
await assert.rejects(() => recordReview(first.db, actor, { ...command, notes: 'Changed payload' }), error => error.code === 'QC_CONFLICT');
for (const overrides of [{ assignedToId: 'other-user' }, { updatedAt: new Date('2026-10-23T12:00:01Z') }, { batch: null }]) {
  const fixture = database(overrides);
  await assert.rejects(() => recordReview(fixture.db, actor, command));
  assert.equal(fixture.state.inspections.length, 0); assert.equal(fixture.state.audits.length, 0);
}
const cancelled = database(); cancelled.state.batch.status = 'CANCELLED';
await assert.rejects(() => recordReview(cancelled.db, actor, command), error => error.code === 'QC_CONFLICT');
const concurrent = database();
const retries = await Promise.all([recordReview(concurrent.db, actor, command), recordReview(concurrent.db, actor, command)]);
assert.deepEqual(retries.map(r => r.replayed), [false, true]); assert.equal(concurrent.state.inspections.length, 1);
const atomic = database(); atomic.failAudit();
await assert.rejects(() => recordReview(atomic.db, actor, command)); assert.equal(atomic.state.inspections.length, 0);
const correction = { ...command, result: 'NON_FUNCTIONAL', mobile: { ...command.mobile, commandId: 'c556c703-297f-4e82-bef9-afbc8dc66b88', expectedUpdatedAt: first.state.device.updatedAt.toISOString() } };
await recordReview(first.db, actor, correction);
assert.equal(first.state.inspections[1].supersedesId, first.state.inspections[0].id);
assert.equal(first.state.inspections[0].reviewerNameSnapshot, 'Revisor original');
assert.equal(first.state.batch.nonFunctionalCount, 1); assert.equal(first.state.batch.functionalCount, 0);
const reentry = database(); reentry.state.inspections.push({ id: 'older-review', status: 'COMPLETED', result: 'FUNCTIONAL', createdAt: new Date('2026-09-01T00:00:00Z') });
await recordReview(reentry.db, actor, command); assert.equal(reentry.state.inspections[1].supersedesId, null);

let current = { ...actor, roleCode: 'QC', status: 'ACTIVE' }; let grant = true;
const http = await load('lib/mobile/qc-http.ts', {
  'next/server': { NextResponse: { json: Response.json } },
  '@/lib/auth/helpers': { can: async () => grant, getPersistedCurrentUser: async () => current },
});
const request = (origin = 'https://core.example', body = '{}') => new Request('https://core.example/api/mobile/qc/review', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-SDigitalCore-Client': 'mobile-v2' }, body });
assert.equal((await http.authorizeQc(request('https://hostile.example'), true)).response.status, 403);
assert.equal((await http.authorizeQc(new Request('https://core.example/api/mobile/qc/review', { method: 'POST', body: '{}' }), true)).response.status, 403);
current = null; assert.equal((await http.authorizeQc(request(), true)).response.status, 401);
current = { ...actor, status: 'INACTIVE' }; assert.equal((await http.authorizeQc(request(), true)).response.status, 401);
current = { ...actor, status: 'ACTIVE' }; grant = false; assert.equal((await http.authorizeQc(request(), true)).response.status, 403);
grant = true; assert.equal((await http.authorizeQc(request(), true)).actor.id, actor.id);
await assert.rejects(() => http.readQcBody(request(undefined, 'x'.repeat(200)), 100));
await assert.rejects(() => http.readQcBody(request(undefined, '{broken'), 100));

let mutations = 0;
const route = await load('app/api/mobile/qc/review/route.ts', {
  '@/lib/mobile/qc-http': http, '@/lib/validation/revision-batch': validation,
  '@/modules/qc/actions/revision-batch': { reviewDeviceAction: async () => { mutations++; return { success: true, message: 'Saved' }; } },
});
assert.equal((await route.POST(request(undefined, JSON.stringify({ ...command, mobile: undefined })))).status, 400); assert.equal(mutations, 0);
assert.equal((await route.POST(request(undefined, JSON.stringify(command)))).status, 200); assert.equal(mutations, 1);

const photo = await load('modules/qc/lib/photo-input.ts', { sharp: { __esModule: true, default: sharp }, zod: { z } });
const png = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#efefef' } }).png().toBuffer();
const normalized = await photo.normalizeQcPhoto(new File([png], 'fake-type.txt', { type: 'text/plain' }));
const metadata = await sharp(Buffer.from(await normalized.arrayBuffer())).metadata();
assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 1600); assert.equal(metadata.exif, undefined);
await assert.rejects(() => photo.normalizeQcPhoto(new File(['not an image'], 'fake.jpg', { type: 'image/jpeg' })));
await assert.rejects(() => photo.normalizeQcPhoto(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'], 'fake.png', { type: 'image/png' })));
await assert.rejects(() => photo.normalizeQcPhoto(new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'big.jpg')));

// Execute the real photo action with in-memory storage/Prisma adapters.
let stored = 0; let photoAudits = 0; const photos = new Map();
const photoTx = { devicePhoto: { create: async ({ data }) => { if (photos.has(data.id)) throw new Error('Duplicate'); photos.set(data.id, data); } }, auditLog: { create: async () => { photoAudits++; } } };
const photoDb = { deviceUnit: { findUnique: async () => ({ id: device.id, assignedToId: actor.id }) }, devicePhoto: { findUnique: async ({ where }) => photos.get(where.id) ?? null, create: photoTx.devicePhoto.create }, $transaction: async work => work(photoTx) };
const storage = { listBuckets: async () => ({ data: [{ name: 'defectos-equipos' }] }), from: () => ({ upload: async () => { stored++; return {}; }, remove: async () => ({}) }) };
const photoActions = await load('modules/qc/actions/device-photos.ts', {
  '@/lib/db/prisma': { prisma: photoDb }, '@/lib/auth/helpers': { requirePermission: async () => actor, getPersistedCurrentUser: async () => current },
  '@/lib/audit': { logAudit: async () => { photoAudits++; } }, '@/lib/storage': { createServiceClient: () => ({ storage }) },
  '../lib/photo-input': photo, zod: { z },
});
function photoForm() { const form = new FormData(); form.set('deviceId', device.id); form.set('mobileCommandId', command.mobile.commandId); form.append('files', normalized); return form; }
current = { ...actor, roleCode: 'QC', status: 'ACTIVE' };
assert.equal((await photoActions.uploadDevicePhotosAction(photoForm())).success, true);
assert.equal((await photoActions.uploadDevicePhotosAction(photoForm())).success, true);
assert.equal(stored, 1); assert.equal(photos.size, 1); assert.equal(photoAudits, 1);
current = { ...current, id: 'other-user', roleCode: 'QC' };
// Persisted actor must correspond to the authenticated session.
const before = stored;
current = { ...current, status: 'INACTIVE' };
assert.equal((await photoActions.uploadDevicePhotosAction(photoForm())).success, false); assert.equal(stored, before);
current = { id: actor.id, roleCode: 'QC', status: 'ACTIVE' };
const readCalls = [];
const readDevice = { ...device, brand: 'Samsung', model: 'A17', imei: '000000000000001', serialNumber: null, assignedTo: { name: actor.name }, inspections: [{ result: 'FUNCTIONAL', createdAt: new Date('2026-09-01T00:00:00Z') }] };
const readers = await load('lib/mobile/qc-data.ts', {
  '@/lib/db/prisma': { prisma: { deviceUnit: {
    findMany: async args => { readCalls.push(args); return Array.from({ length: 21 }, (_, i) => ({ ...readDevice, id: `test-${i}` })); },
    findUnique: async () => readDevice,
  } } },
  '@/lib/auth/helpers': { can: async () => true },
  '@/modules/qc/actions/device-history': { getDeviceHistoryAction: async () => ({ success: true, data: { inspections: [{ id: 'old', reviewerNameSnapshot: 'Revisor anterior', functionalityNotes: 'Nota anterior', reviewedAt: null, createdAt: new Date('2026-09-01T00:00:00Z') }], photos: [] } }) },
});
const page = await readers.readQc(current, 'A17', 2);
assert.equal(page.devices.length, 20); assert.equal(page.hasMore, true);
assert.equal(readCalls[0].where.assignedToId, actor.id); assert.equal(readCalls[0].skip, 20); assert.equal(readCalls[0].take, 21);
assert.equal(page.devices[0].result, null); // A prior lot's inspection never marks this entry reviewed.
assert.equal(page.devices[0].canReview, true);
assert.equal(readers.qcDeviceDTO({ ...readDevice, assignedToId: 'other-user' }, current, true).canReview, false);
assert.equal(readers.qcDeviceDTO(readDevice, current, false).canReview, false);
await readers.readQc({ ...current, roleCode: 'ADMIN' }, '', 1); assert.equal(readCalls[1].where.assignedToId, undefined);
const history = await readers.readQcDetail(current, device.id);
assert.equal(history.inspections[0].reviewerNameSnapshot, 'Revisor anterior'); assert.equal(history.inspections[0].functionalityNotes, 'Nota anterior');
console.log('Mobile QC: transactional reviews, retries, corrections, assignment, checklist, auth/CSRF, upload validation and photo replay passed (isolated fixtures).');
