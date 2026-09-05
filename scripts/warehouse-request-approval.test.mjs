import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { z } from 'zod';
const source=fs.readFileSync('modules/almacen/actions/warehouse.ts','utf8');
const action=source.slice(source.indexOf('export async function updateWarehouseRequestStatusAction'));
const js=ts.transpileModule(action,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
async function run({claimed=1,status='APPROVED',stock=100,notifyFails=false}={}) {
 const calls={stock:0,moves:0,audit:0};
 const items=Array.from({length:33},(_,i)=>({productId:String(i),unitsCount:2}));
 const tx={warehouseRequest:{updateMany:async()=>({count:claimed}),findUnique:async()=>({id:'r',status,items,type:'EXIT',requestCode:'SOL',title:'Test'})},auditLog:{create:async()=>{calls.audit++}},warehouseProduct:{findMany:async()=>items.map(i=>({id:i.productId,code:i.productId,name:'Test',boxes:0,looseUnits:stock,totalUnits:stock,unitsPerBox:1}))},warehouseMovement:{createMany:async({data})=>{calls.moves=data.length}}};
 const prisma={$transaction:async(fn,options)=>{assert.equal(options.timeout,30000);return fn(tx)},warehouseRequest:{findUnique:async()=>{if(notifyFails)throw Error('notification');return null}}};
 const mod={exports:{}};
 new Function('exports','prisma','requireWarehouseAdmin','z','parseRequestLine','resolveMovementLine','availableQuantity','applyStockDelta','sendPushToUsers','revalidatePath','console',js)(mod.exports,prisma,async()=>({id:'admin'}),z,()=>({measure:'UNITS',quantity:2}),()=>({measure:'UNITS',quantity:2,unitsCount:2,boxesCount:0}),p=>p.looseUnits,async()=>{calls.stock++},async()=>{},()=>{},{error:()=>{}});
 const result=await mod.exports.updateWarehouseRequestStatusAction('r',status);
 return {result,calls};
}
let r=await run();assert.equal(r.result.success,true);assert.equal(r.calls.stock,33);assert.equal(r.calls.moves,33);assert.equal(r.calls.audit,1);
r=await run({claimed:0});assert.equal(r.result.success,false);assert.equal(r.calls.stock,0);
r=await run({status:'REJECTED'});assert.equal(r.result.success,true);assert.equal(r.calls.stock,0);
r=await run({stock:1});assert.equal(r.result.success,false);assert.match(r.result.error,/Stock insuficiente/);
r=await run({notifyFails:true});assert.equal(r.result.success,true);
r=await run({status:'INVALID'});assert.equal(r.result.success,false);assert.equal(r.calls.stock,0);
console.log('Warehouse approval: 33 lines, duplicate claim, rejection, insufficient stock, notification failure and invalid status passed.');
