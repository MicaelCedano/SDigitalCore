import assert from "node:assert/strict";
import { createSdigitalMcpServer, MCP_TOOL_NAMES } from "../lib/mcp/server";
import {
  assessEquipo,
  assessGarantia,
  assessLote,
  assessSolicitudDecision,
  assessTarea,
  computeVersionHash,
  REVERT_ENTITIES,
  SOLICITUD_ALMACEN_REVERT_ERROR,
  warrantyMove,
  WRITE_ENTITIES,
} from "../lib/mcp/validation";
import {
  buildWarehouseDecisionPreview,
  planWarehouseRequestLines,
  projectStockAfterMovement,
  warehouseDecisionSnapshotsMatch,
  warehouseRequestVersionSnapshot,
  type WarehouseRequestView,
} from "../modules/almacen/lib/warehouse-request-plan";

const garantia = {
  status: "RECEIVED" as const,
  archivedAt: null,
  cliente: "Ana",
  modelo: "iPhone 12",
  color: "Negro",
  imei: "123456789012345",
  problema: "No enciende",
};

async function run() {
  const mismo = computeVersionHash({ id: "a", estado: "RECEIVED" });
  assert.equal(mismo, computeVersionHash({ estado: "RECEIVED", id: "a" }));
  assert.notEqual(mismo, computeVersionHash({ id: "a", estado: "IN_REPAIR" }));

  const entrega = assessGarantia(garantia, { estado: "DELIVERED" });
  assert.equal(entrega.ok, false);
  assert.ok(entrega.errors.some((error) => error.includes("nota de crédito")));

  const archivo = assessGarantia(garantia, { archivar: true });
  assert.equal(archivo.ok, false);

  const asignar = warrantyMove("RECEIVED", "IN_REPAIR");
  assert.deepEqual(asignar, { kind: "flow", operation: "assign" });
  assert.equal(warrantyMove("READY_FOR_CUSTOMER", "DELIVERED"), null);
  assert.equal(warrantyMove("IN_REPAIR", "CREDIT_NOTE"), null);

  const sinTecnico = assessGarantia(garantia, { estado: "IN_REPAIR" });
  assert.equal(sinTecnico.ok, false);
  const conTecnico = assessGarantia(garantia, { estado: "IN_REPAIR", contraparte: "Carlos" });
  assert.equal(conTecnico.ok, true);
  assert.equal(conTecnico.cambios.estado, "IN_REPAIR");

  const imei = assessEquipo(
    { marca: "Apple", modelo: "iPhone 13", almacenamientoGb: 128, color: "Azul", resultado: "FUNCTIONAL" },
    { imei: "123456789012345", modelo: "iPhone 14" },
  );
  assert.equal(imei.ok, false);
  assert.ok(imei.errors.some((error) => error.includes("imei")));

  const lote = assessLote({ estado: "IN_REVIEW", notas: null }, { estado: "COMPLETED" });
  assert.equal(lote.ok, false);
  const enviado = assessLote({ estado: "IN_REVIEW", notas: null }, { estado: "SUBMITTED" });
  assert.equal(enviado.ok, false);
  const cancelar = assessLote({ estado: "IN_REVIEW", notas: null }, { estado: "CANCELLED" });
  assert.equal(cancelar.ok, true);

  const automatica = assessTarea(
    { titulo: "Revisar", descripcion: null, prioridad: "NORMAL", vence: null, estado: "PENDING", kind: "AUTOMATIC" },
    { titulo: "Otro título" },
  );
  assert.equal(automatica.ok, false);
  const comentario = assessTarea(
    { titulo: "Revisar", descripcion: null, prioridad: "NORMAL", vence: null, estado: "PENDING", kind: "MANUAL" },
    { comentario: "Listo para retirar" },
  );
  assert.equal(comentario.ok, true);

  const server = createSdigitalMcpServer();
  assert.ok(server);
  assert.equal(MCP_TOOL_NAMES.length, 37);
  assert.ok(MCP_TOOL_NAMES.includes("preparar_cambios"));
  assert.ok(MCP_TOOL_NAMES.includes("pendientes_pago"));
  assert.equal(MCP_TOOL_NAMES.includes("buscar_envio" as never), false);
  assert.ok(WRITE_ENTITIES.includes("solicitud_almacen"));
  assert.equal(REVERT_ENTITIES.includes("solicitud_almacen" as never), false);
  assert.match(SOLICITUD_ALMACEN_REVERT_ERROR, /inventario/);

  const decision = assessSolicitudDecision({ estado: "APPROVED", nota: "ignorar" });
  assert.equal(decision.ok, true);
  assert.deepEqual(decision.cambios, { estado: "APPROVED" });
  assert.equal(decision.warnings.length, 1);
  assert.equal(assessSolicitudDecision({ estado: "PENDING" }).ok, false);
  assert.equal(assessSolicitudDecision({}).ok, false);

  const product = {
    id: "p1",
    code: "CAB-1",
    name: "Cable",
    color: "Negro",
    status: "ACTIVE",
    boxes: 0,
    looseUnits: 1,
    totalUnits: 5,
    unitsPerBox: 1,
  };
  const regularized = projectStockAfterMovement(product, "EXIT", { measure: "UNITS", quantity: 2, unitsCount: 2 });
  assert.deepEqual(regularized, { boxes: 0, looseUnits: 3, totalUnits: 3 });

  const request: WarehouseRequestView = {
    id: "req",
    requestCode: "SOL-1",
    title: "Salida",
    branch: "Central",
    requestedBy: "Ana",
    type: "EXIT",
    status: "PENDING",
    details: JSON.stringify({ items: { p2: { measure: "BOXES", quantity: 1 } } }),
    updatedAt: new Date("2026-11-11T12:00:00.000Z"),
    items: [
      { productId: "p1", unitsCount: 2, product: { ...product, looseUnits: 1, totalUnits: 1 } },
      {
        productId: "p2",
        unitsCount: 10,
        product: { ...product, id: "p2", code: "BOX-1", boxes: 4, looseUnits: 0, totalUnits: 40, unitsPerBox: 10 },
      },
    ],
  };
  const exitPreview = buildWarehouseDecisionPreview(request, "APPROVED");
  assert.equal(exitPreview.ok, false);
  assert.ok(exitPreview.errores.some((error) => error.includes("Stock insuficiente") && error.includes("CAB-1")));
  const cable = exitPreview.vista.items.find((item) => item.codigo === "CAB-1");
  assert.equal(cable?.stock_actual?.disponible, 1);
  assert.equal(cable?.stock_resultante?.total, -1);
  const boxes = exitPreview.vista.items.find((item) => item.codigo === "BOX-1");
  assert.equal(boxes?.error, null);
  assert.equal(boxes?.stock_resultante?.cajas, 3);
  assert.equal(boxes?.stock_resultante?.total, 30);

  const boxedUnits = planWarehouseRequestLines({
    type: "EXIT",
    details: JSON.stringify({ items: { p2: { measure: "UNITS", quantity: 5 } } }),
    statusDecision: "APPROVED",
    items: [request.items[1]],
  });
  assert.equal(boxedUnits.errors.length, 1);
  assert.match(boxedUnits.errors[0], /unidades sueltas/);
  assert.equal(boxedUnits.lines[0]?.stockActual?.disponible, 0);

  const inactive = buildWarehouseDecisionPreview({
    ...request,
    items: [{ productId: "p1", unitsCount: 1, product: { ...product, status: "INACTIVE", looseUnits: 5, totalUnits: 5 } }],
  }, "APPROVED");
  assert.equal(inactive.ok, false);
  assert.match(inactive.errores[0], /no está activo/);
  assert.equal(inactive.vista.items[0]?.estado_producto, "INACTIVE");
  const inactivePlan = planWarehouseRequestLines({
    type: "EXIT",
    details: null,
    statusDecision: "APPROVED",
    items: [{ productId: "p1", unitsCount: 1, product: { ...product, status: "INACTIVE", looseUnits: 5, totalUnits: 5 } }],
  });
  assert.match(inactivePlan.errors[0], /ya no existe/);

  const rejected = buildWarehouseDecisionPreview({
    ...request,
    items: [{ productId: "p1", unitsCount: 2, product }],
  }, "REJECTED");
  assert.equal(rejected.ok, true);
  assert.equal(rejected.vista.items[0]?.stock_resultante?.total, rejected.vista.items[0]?.stock_actual?.total);
  assert.match(rejected.advertencias[0], /no mueve inventario/);

  const closed = buildWarehouseDecisionPreview({ ...request, status: "APPROVED" }, "REJECTED");
  assert.equal(closed.ok, false);
  assert.match(closed.errores[0], /no está pendiente/);

  const entry = buildWarehouseDecisionPreview({
    ...request,
    type: "ENTRY",
    items: [{ productId: "p1", unitsCount: 2, product: { ...product, looseUnits: 1, totalUnits: 1 } }],
  }, "APPROVED");
  assert.equal(entry.ok, true);
  assert.equal(entry.vista.items[0]?.stock_resultante?.total, 3);

  const forward = warehouseRequestVersionSnapshot(request);
  const reversed = warehouseRequestVersionSnapshot({ ...request, items: [...request.items].reverse() });
  assert.equal(computeVersionHash(forward), computeVersionHash(reversed));
  assert.notEqual(computeVersionHash(forward), computeVersionHash(warehouseRequestVersionSnapshot({
    ...request,
    items: [{ ...request.items[0], product: { ...product, totalUnits: 4, looseUnits: 0 } }, request.items[1]],
  })));
  const approved = warehouseRequestVersionSnapshot(request);
  assert.equal(warehouseDecisionSnapshotsMatch(approved, { ...approved, estado: "APPROVED", actualizado: "2099-01-01T00:00:00.000Z" }), true);
  const drifted = warehouseRequestVersionSnapshot({
    ...request,
    items: request.items.map((item) => item.productId === "p2" && item.product
      ? { ...item, product: { ...item.product, unitsPerBox: 20 } }
      : item),
  });
  assert.equal(warehouseDecisionSnapshotsMatch(approved, drifted), false);

  console.log("Pruebas del MCP de SDigitalCore pasaron.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
