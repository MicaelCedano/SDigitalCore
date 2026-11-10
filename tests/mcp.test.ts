import assert from "node:assert/strict";
import { createSdigitalMcpServer, MCP_TOOL_NAMES } from "../lib/mcp/server";
import {
  assessEquipo,
  assessGarantia,
  assessLote,
  assessTarea,
  computeVersionHash,
  warrantyMove,
} from "../lib/mcp/validation";

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

  console.log("Pruebas del MCP de SDigitalCore pasaron.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
