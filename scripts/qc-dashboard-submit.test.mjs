import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../modules/qc/components/QcDashboardView.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const states = [];
let cursor = 0;
let submissions = 0;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require(name) {
    if (name === "react") return { useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    } };
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name.includes("revision-batch")) return {
      submitRevisionBatchAction: async ({ id }) => {
        assert.equal(id, "batch-122");
        submissions++;
        return { success: true, message: "Enviado" };
      },
    };
    return new Proxy({}, { get: (_, key) => String(key) });
  },
});
const initialData = {
  devices: [{ id: "device-1", batch: { id: "batch-122", batchNumber: "LOT-122", status: "IN_REVIEW", createdAt: "2026-09-01" }, lastInspection: { status: "COMPLETED", createdAt: "2026-09-05" } }],
  stats: { ganadoHoy: 0, saldoWallet: 0 }, myRequests: [],
};
const render = () => { cursor = 0; return exports.QcDashboardView({ initialData }); };
const flatten = (node) => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === "object" ? [node, ...flatten(node.props?.children)] : [];
const label = (node) => Array.isArray(node) ? node.map(label).join("") : node && typeof node === "object" ? label(node.props?.children) : typeof node === "string" ? node : "";
const button = (tree, text) => flatten(tree).find((node) => node.type === "button" && label(node).trim() === text);
let tree = render();
assert.ok(button(tree, "Enviar para pago"), "Las fechas serializadas deben habilitar el envío al terminar la revisión");
button(tree, "Enviar para pago").props.onClick();
tree = render();
button(tree, "Enviar mi porción").props.onClick();
await new Promise((resolve) => setImmediate(resolve));
tree = render();
assert.equal(submissions, 1);
assert.equal(button(tree, "Enviar para pago"), undefined);
assert.ok(label(tree).includes("Esperando aprobación y pago"));
states.length = 0;
initialData.devices[0].lastInspection.status = "IN_PROGRESS";
assert.equal(button(render(), "Enviar para pago"), undefined, "Los equipos pendientes no pueden enviarse");
console.log("QC dashboard: review completion, confirmation, submission and pending-payment state passed.");
