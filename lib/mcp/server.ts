import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const limite = z.number().int().min(1).max(20).optional().default(5).describe("Cantidad máxima de resultados (por defecto 5)");
const consulta = z.string().min(1).describe("Texto a buscar");
const idOCodigo = z.union([z.string(), z.number()]).describe("Id o código visible del registro");

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

function textResult(value: unknown, isError = false) {
  return { isError, content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

export function createSdigitalMcpServer() {
  const server = new McpServer({ name: "sdigitalcore-mcp", version: "1.0.0" });

  const read = (
    name: string,
    title: string,
    description: string,
    inputSchema: Record<string, z.ZodType>,
  ) => {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: READ_ONLY },
      async (args) => {
        try {
          const { runRead } = await import("@/lib/mcp/reads");
          return textResult(await runRead(name, args as Record<string, unknown>));
        } catch (error) {
          return textResult(error instanceof Error ? error.message : "No se pudo consultar.", true);
        }
      },
    );
  };

  read("buscar_garantia", "Buscar garantía", "Busca casos de garantía por código, IMEI, cliente o modelo.", { query: consulta, limite, estado: z.string().optional(), incluir_archivados: z.boolean().optional() });
  read("obtener_garantia", "Obtener garantía", "Ficha de una garantía por id o código, con version_hash.", { id_o_codigo: idOCodigo });
  read("buscar_trabajo_reparacion", "Buscar trabajo de reparación", "Busca la cola de pago a técnicos. No es la orden del cliente.", { query: consulta, limite, estado: z.string().optional() });
  read("obtener_trabajo_reparacion", "Obtener trabajo de reparación", "Detalle de un trabajo de reparación y sus equipos. No acredita pagos.", { id_o_codigo: idOCodigo });
  read("buscar_desbloqueo", "Buscar desbloqueo", "Busca solicitudes de desbloqueo por código, modelo, técnico o IMEI.", { query: consulta, limite, estado: z.string().optional() });
  read("obtener_desbloqueo", "Obtener desbloqueo", "Detalle de una solicitud de desbloqueo, sin acreditar pago.", { id_o_codigo: idOCodigo });
  read("buscar_equipo", "Buscar equipo QC", "Busca un equipo por IMEI, serial, marca o modelo.", { query: consulta, limite });
  read("obtener_equipo", "Obtener equipo QC", "Ficha del equipo y sus revisiones. El version_hash no incluye la edición de IMEI.", { id_o_codigo: idOCodigo });
  read("buscar_lote_qc", "Buscar lote QC", "Busca lotes de revisión por número, suplidor o sucursal.", { query: consulta, limite, estado: z.string().optional() });
  read("obtener_lote_qc", "Obtener lote QC", "Detalle de un lote QC y una muestra de sus equipos.", { id_o_codigo: idOCodigo });
  read("buscar_producto", "Buscar producto de almacén", "Busca productos por código, nombre o marca. Incluye existencias, sin modificarlas.", { query: consulta, limite });
  read("obtener_producto", "Obtener producto de almacén", "Ficha de stock de un producto. Esta versión no mueve inventario.", { id_o_codigo: idOCodigo });
  read("buscar_solicitud_almacen", "Buscar solicitud de almacén", "Busca solicitudes de entrada o salida. No las aprueba.", { query: consulta, limite, estado: z.string().optional() });
  read("obtener_solicitud_almacen", "Obtener solicitud de almacén", "Detalle de una solicitud y sus productos.", { id_o_codigo: idOCodigo });
  read("buscar_recibo", "Buscar recibo", "Busca recibos de mercancía por número, suplidor o sucursal.", { query: consulta, limite, estado: z.string().optional() });
  read("obtener_recibo", "Obtener recibo", "Recibo con sus líneas. No importa el recibo al inventario.", { id_o_codigo: idOCodigo });
  read("buscar_conteo", "Buscar conteo", "Busca conteos físicos de stock.", { query: consulta, limite, estado: z.string().optional() });
  read("obtener_conteo", "Obtener conteo", "Conteo con sus líneas. No aplica diferencias al stock.", { id_o_codigo: idOCodigo });
  read("buscar_factura", "Buscar factura", "Busca facturas o conduces por número, NCF o cliente.", { query: consulta, limite, tipo: z.enum(["FACTURA", "CONDUCE"]).optional() });
  read("obtener_factura", "Obtener factura", "Factura con sus artículos. No emite ni anula comprobantes.", { id_o_codigo: idOCodigo });
  read("buscar_precio", "Buscar precio", "Busca la lista de precios, incluyendo costo y precio mínimo.", { query: consulta, limite });
  read("obtener_precio", "Obtener precio", "Precio de un modelo, con precio_costo y precio_minimo. No lo modifica.", { id_o_codigo: idOCodigo });
  read("buscar_tercero", "Buscar cliente o suplidor", "Busca business partners por nombre, teléfono, RNC o correo.", { query: consulta, limite, tipo: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]).optional() });
  read("obtener_tercero", "Obtener cliente o suplidor", "Ficha de un cliente o suplidor. Esta versión no lo edita.", { id_o_codigo: idOCodigo });
  read("buscar_suplidor_qc", "Buscar suplidor QC", "Busca suplidores usados en control de calidad.", { query: consulta, limite });
  read("obtener_suplidor_qc", "Obtener suplidor QC", "Ficha de un suplidor QC.", { id_o_codigo: idOCodigo });
  read("buscar_sucursal", "Buscar sucursal", "Busca sucursales por nombre, código o dirección.", { query: consulta, limite });
  read("obtener_sucursal", "Obtener sucursal", "Ficha de una sucursal.", { id_o_codigo: idOCodigo });
  read("buscar_tarea", "Buscar tarea", "Busca tareas del centro de trabajo por título, módulo o código de origen.", { query: consulta, limite, estado: z.string().optional() });
  read("obtener_tarea", "Obtener tarea", "Tarea con eventos recientes y version_hash.", { id_o_codigo: idOCodigo });
  read("resumen_operacion", "Resumen de operación", "Conteos de garantías, solicitudes pendientes, lotes QC abiertos y pagos por aprobar.", {});
  read("avance_lotes_qc", "Avance de lotes QC", "Porcentaje de equipos revisados por lote. No representa dinero.", { query: z.string().optional(), limite });
  read("pendientes_pago", "Pendientes de pago", "Trabajos, desbloqueos y lotes enviados que esperarían un pago. Solo lectura.", {});

  const propuesta = z.record(z.string(), z.unknown()).describe("Campos a cambiar. Garantía, equipo QC, lote QC o tarea.");
  server.registerTool(
    "preparar_cambios",
    {
      title: "Preparar cambios",
      description: "Valida una propuesta para garantia, equipo_qc, lote_qc o tarea. Devuelve operacion_id, diff y version_hash. No escribe.",
      inputSchema: {
        entidad: z.enum(["garantia", "equipo_qc", "lote_qc", "tarea"]),
        id_o_codigo: idOCodigo,
        propuesta,
        justificacion: z.string().max(1000).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ entidad, id_o_codigo, propuesta: patch, justificacion }) => {
      try {
        const { prepararCambios } = await import("@/lib/mcp/operations");
        return textResult(await prepararCambios(entidad, String(id_o_codigo), patch, justificacion));
      } catch (error) {
        return textResult(error instanceof Error ? error.message : "No se pudo preparar.", true);
      }
    },
  );

  server.registerTool(
    "confirmar_cambios",
    {
      title: "Confirmar cambios",
      description: "Aplica solo el preview ya validado. Exige operacion_id, version_hash, los cambios aprobados y aprobacion_explicita true.",
      inputSchema: {
        entidad: z.enum(["garantia", "equipo_qc", "lote_qc", "tarea"]),
        id_o_codigo: idOCodigo,
        operacion_id: z.string().uuid(),
        version_hash: z.string().min(8),
        cambios_aprobados: z.record(z.string(), z.unknown()),
        aprobacion_explicita: z.boolean(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        const { confirmarCambios } = await import("@/lib/mcp/operations");
        return textResult(await confirmarCambios({
          entidad: args.entidad,
          idOCodigo: String(args.id_o_codigo),
          operacionId: args.operacion_id,
          versionHash: args.version_hash,
          cambiosAprobados: args.cambios_aprobados,
          aprobacionExplicita: args.aprobacion_explicita,
        }));
      } catch (error) {
        return textResult(error instanceof Error ? error.message : "No se pudo confirmar.", true);
      }
    },
  );

  server.registerTool(
    "verificar_cambios",
    {
      title: "Verificar cambios",
      description: "Vuelve a leer el registro y compara campo por campo contra la operación o contra campos esperados.",
      inputSchema: {
        entidad: z.enum(["garantia", "equipo_qc", "lote_qc", "tarea"]),
        id_o_codigo: idOCodigo,
        operacion_id: z.string().uuid().optional(),
        campos_esperados: z.record(z.string(), z.unknown()).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        const { verificarCambios } = await import("@/lib/mcp/operations");
        return textResult(await verificarCambios(args.entidad, String(args.id_o_codigo), args.operacion_id, args.campos_esperados));
      } catch (error) {
        return textResult(error instanceof Error ? error.message : "No se pudo verificar.", true);
      }
    },
  );

  server.registerTool(
    "revertir_cambios",
    {
      title: "Revertir cambios",
      description: "Restaura el snapshot anterior de una operación aplicada si nadie escribió después. Exige aprobacion_explicita true.",
      inputSchema: {
        entidad: z.enum(["garantia", "equipo_qc", "lote_qc", "tarea"]),
        id_o_codigo: idOCodigo,
        operacion_id: z.string().uuid(),
        aprobacion_explicita: z.boolean(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        const { revertirCambios } = await import("@/lib/mcp/operations");
        return textResult(await revertirCambios(args.entidad, String(args.id_o_codigo), args.operacion_id, args.aprobacion_explicita));
      } catch (error) {
        return textResult(error instanceof Error ? error.message : "No se pudo revertir.", true);
      }
    },
  );

  return server;
}

export const MCP_TOOL_NAMES = [
  "buscar_garantia",
  "obtener_garantia",
  "buscar_trabajo_reparacion",
  "obtener_trabajo_reparacion",
  "buscar_desbloqueo",
  "obtener_desbloqueo",
  "buscar_equipo",
  "obtener_equipo",
  "buscar_lote_qc",
  "obtener_lote_qc",
  "buscar_producto",
  "obtener_producto",
  "buscar_solicitud_almacen",
  "obtener_solicitud_almacen",
  "buscar_recibo",
  "obtener_recibo",
  "buscar_conteo",
  "obtener_conteo",
  "buscar_factura",
  "obtener_factura",
  "buscar_precio",
  "obtener_precio",
  "buscar_tercero",
  "obtener_tercero",
  "buscar_suplidor_qc",
  "obtener_suplidor_qc",
  "buscar_sucursal",
  "obtener_sucursal",
  "buscar_tarea",
  "obtener_tarea",
  "resumen_operacion",
  "avance_lotes_qc",
  "pendientes_pago",
  "preparar_cambios",
  "confirmar_cambios",
  "verificar_cambios",
  "revertir_cambios",
] as const;
