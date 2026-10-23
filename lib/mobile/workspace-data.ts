import { getWarehouseProductsAction } from "@/modules/almacen/actions/warehouse";
import { getGoodsReceiptsAction } from "@/modules/almacen/actions/goods-receipt";
import { listWarrantyCases } from "@/modules/garantias/actions/warranty";
import { getPendingRepairJobsAction, getRepairDashboardAction } from "@/modules/reparaciones/actions/repairs";
import { getUnlockRequestsAction } from "@/modules/desbloqueos/actions/unlocks";
import { getInvoicesAction } from "@/modules/facturas/actions/invoice";
import { getQcDashboardAction, getRevisionBatchesAction } from "@/modules/qc/actions/revision-batch";
import { getWorkCenterData } from "@/modules/centro-trabajo/data";
import { getCurrentWallet } from "@/modules/wallet/data";
import { getBranchesAction } from "@/modules/configuracion/actions/branch";
import { WORKSPACE_MODULES, type WorkspaceEntry, type WorkspaceField, type WorkspaceKey, type WorkspacePage } from "./workspace-contract";

export const WORKSPACE_PERMISSIONS: Record<WorkspaceKey, string> = {
  qc: "qc.read", almacen: "warehouse.read", recibos: "warehouse.read",
  garantias: "warranties.read", reparaciones: "reparaciones.read", desbloqueos: "desbloqueos.read",
  "centro-trabajo": "centro-trabajo.read", facturas: "facturas.read", wallet: "wallet.read", configuracion: "settings.read",
};

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value !== null && typeof value === "object" ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(row) : [];
const text = (value: unknown): string => value == null ? "" : String(value);
const date = (value: unknown) => value ? new Date(text(value)).toISOString() : null;
const field = (label: string, value: unknown): WorkspaceField => ({ label, value: text(value) || "Sin registrar" });
const money = (value: unknown) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(Number(value ?? 0));
const lines = (value: unknown, title: (item: Row) => string, subtitle: (item: Row) => string) => {
  const all = rows(value);
  const shown = all.slice(0, 80).map(item => ({ title: title(item), subtitle: subtitle(item) }));
  if (all.length > 80) shown.push({ title: `${all.length - 80} líneas adicionales`, subtitle: "Abre el documento completo en SDigitalCore Web." });
  return shown;
};
function entry(item: Row, values: Partial<WorkspaceEntry>): WorkspaceEntry {
  return { id: text(item.id), title: "Registro", subtitle: "", code: "", status: text(item.status), date: date(item.createdAt), fields: [], lines: [], ...values };
}
function data(result: { success: boolean; data?: unknown; error?: string }): unknown {
  if (!result.success) throw new Error("No se pudo consultar el módulo.");
  // Normalizes Dates/Prisma Decimals before the explicit public-field projection.
  return JSON.parse(JSON.stringify(result.data ?? null));
}

/** Adapts existing business readers; contains no write or payment operation. */
export async function readWorkspaceModule(key: WorkspaceKey, query: string, page: number, actor: { roleCode: string }): Promise<WorkspacePage> {
  let entries: WorkspaceEntry[] = [];
  let metrics: WorkspaceField[] = [];
  let total: number | undefined;
  let alreadyPaged = false;
  let notice = "Vista de registros recientes. Busca por nombre, código o IMEI para acotar la consulta.";

  if (key === "almacen") {
    const items = rows(data(await getWarehouseProductsAction(query, { limit: 100 })));
    entries = items.map(item => entry(item, {
      title: text(item.name), subtitle: [item.brand, item.capacity, item.color].filter(Boolean).join(" · "), code: text(item.code),
      fields: [field("Unidades disponibles", item.totalUnits), field("Cajas", item.boxes), field("Unidades por caja", item.unitsPerBox), field("Unidades sueltas", item.looseUnits), field("Descripción", item.description)],
    }));
    metrics = [field("Productos en consulta", items.length), field("Unidades en consulta", items.reduce((sum, item) => sum + Number(item.totalUnits), 0))];
    notice = "Hasta 100 productos por búsqueda. Las cantidades corresponden al inventario actual.";
  } else if (key === "recibos") {
    const items = rows(data(await getGoodsReceiptsAction(query)));
    entries = items.map(item => entry(item, {
      title: text(item.receiptNumber), code: text(item.receiptNumber), subtitle: text(item.supplierName), date: date(item.receivedAt),
      fields: [field("Suplidor", item.supplierName), field("Sucursal", item.branch), field("Recibido por", item.receivedBy), field("Observaciones", item.notes)],
      lines: lines(item.items, line => text(line.description), line => `${text(line.quantity)} unidades · ${text(line.imeiOrSerial) || "Sin IMEI"}${line.notes ? `\n${text(line.notes)}` : ""}`),
    }));
  } else if (key === "garantias") {
    const result = row(data(await listWarrantyCases({ search: query, page, pageSize: 20, archive: "all" })));
    entries = rows(result.cases).map(item => entry(item, {
      title: text(item.model), code: text(item.caseCode), subtitle: text(item.clientName), imei: text(item.imei), date: date(item.entryDate),
      status: item.archivedAt ? "ARCHIVED" : text(item.status),
      fields: [field("IMEI", item.imei), field("Cliente", item.clientName), field("Problema reportado", item.problem), field("Eventos registrados", row(item._count).events)],
    }));
    total = Number(result.total);
    metrics = [field("Casos encontrados", total)];
    alreadyPaged = true;
    notice = "Incluye casos activos, entregados y archivados. Resultados paginados de la búsqueda.";
  } else if (key === "reparaciones") {
    let jobs: Row[];
    if (actor.roleCode === "ADMIN") {
      jobs = rows(data(await getPendingRepairJobsAction()));
      notice = "Trabajos pendientes de pago, excluyendo tus propios trabajos. La aprobación se realiza en el sistema actual.";
    } else {
      const dashboard = row(row(data(await getRepairDashboardAction({ queuePage: 1, queuePageSize: 50 }))).data);
      entries = rows(dashboard.queue).map(item => entry(item, {
        id: `queue-${text(item.id)}`, title: text(item.model), code: text(item.caseCode), subtitle: text(item.clientName), imei: text(item.imei), status: "IN_REPAIR", date: date(item.entryDate),
        fields: [field("IMEI", item.imei), field("Problema", item.problem), field("Cliente", item.clientName)],
      }));
      jobs = rows(dashboard.myJobs);
      notice = "Tus primeros 50 equipos en cola y tus últimos 100 trabajos reportados.";
    }
    entries.push(...jobs.map(item => entry(item, {
      id: `job-${text(item.id)}`, title: text(item.jobCode), code: text(item.jobCode), subtitle: text(row(item.technician).name) || "Trabajo reportado",
      fields: [field("Equipos", rows(item.items).length), field("Monto total", money(item.montoTotal)), field("Observaciones", item.observaciones)],
      lines: lines(item.items, line => text(line.modelo) || text(line.marca) || "Equipo", line => `${text(line.imei)} · ${text(line.resultado)}\n${text(line.problema)}`),
    })));
  } else if (key === "desbloqueos") {
    entries = rows(data(await getUnlockRequestsAction())).map(item => entry(item, {
      title: text(item.model), code: text(item.requestCode), subtitle: text(row(item.technician).name) || "Solicitud de desbloqueo",
      fields: [field("Equipos", item.totalEquipos), field("Monto pagado", money(item.montoTotalPagado)), field("Observaciones", item.observacion), field("Respuesta administrativa", item.adminObservation)],
      lines: (Array.isArray(item.imeis) ? item.imeis : []).slice(0, 80).map((imei: unknown) => ({ title: typeof imei === "string" ? imei : text(row(imei).imei), subtitle: "IMEI de la solicitud" })),
    }));
    notice = "Hasta 200 solicitudes recientes. Los técnicos solo consultan sus propias solicitudes.";
  } else if (key === "facturas") {
    entries = rows(data(await getInvoicesAction(query))).map(item => entry(item, {
      title: text(item.invoiceNumber), code: text(item.ncf) || text(item.invoiceNumber), subtitle: text(item.clientName),
      fields: [field("Tipo", item.type), field("Cliente", item.clientName), field("Sucursal", item.branch), field("Total", item.type === "CONDUCE" ? "Documento de entrega" : money(item.total)), field("Observaciones", item.notes)],
      lines: lines(item.items, line => text(line.description), line => `${text(line.quantity)} unidades${item.type === "CONDUCE" ? "" : ` · ${money(line.totalPrice)}`}\n${text(line.imeis) || "Sin IMEI registrado"}`),
    }));
    notice = "Últimos 100 documentos coincidentes. Los conduces muestran sus equipos sin importes de factura.";
  } else if (key === "qc") {
    if (actor.roleCode === "ADMIN") {
      entries = rows(data(await getRevisionBatchesAction(query))).map(item => entry(item, {
        title: text(item.batchNumber), code: text(item.batchNumber), subtitle: text(item.supplierName), date: date(item.receivedAt),
        fields: [field("Suplidor", item.supplierName), field("Equipos", item.totalDevices), field("Revisados", item.reviewedDevices), field("Funcionales", item.functionalCount), field("No funcionales", item.nonFunctionalCount), field("Observaciones", item.notes)],
      }));
    } else {
      const dashboard = row(data(await getQcDashboardAction()));
      entries = rows(dashboard.devices).map(item => entry(item, {
        title: [item.brand, item.model].filter(Boolean).join(" "), code: text(row(item.batch).batchNumber), subtitle: text(row(item.batch).supplierName), imei: text(item.imei), date: date(item.updatedAt),
        fields: [field("IMEI", item.imei), field("Serie", item.serialNumber), field("Lote", row(item.batch).batchNumber), field("Porción enviada", item.assignmentSubmitted ? "Sí" : "No")],
      }));
      metrics = [field("Asignados", row(dashboard.stats).asignados), field("Pendientes", row(dashboard.stats).pendientes), field("Revisados hoy", row(dashboard.stats).revisadosHoy)];
      notice = "Hasta 100 equipos asignados a tu cuenta. Consulta el IMEI para ver el revisor y sus observaciones.";
    }
  } else if (key === "centro-trabajo") {
    const result = await getWorkCenterData({ syncQc: false });
    if (!result.schemaReady) throw new Error("Centro de trabajo no disponible.");
    entries = rows([...result.tasks, ...result.historyTasks]).map(item => entry(item, {
      title: text(item.title), code: text(item.sourceCode), subtitle: text(item.sourceModule),
      fields: [field("Descripción", item.description), field("Prioridad", item.priority), field("Responsable", row(item.assignee).name || "Sin asignar"), field("Vencimiento", item.dueAt ? new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", dateStyle: "medium" }).format(new Date(text(item.dueAt))) : "Sin fecha"), field("Avance", `${text(item.progressDone) || "0"} / ${text(item.progressTotal) || "—"}`)],
      lines: lines(item.events, event => text(event.type), event => text(row(event.actor).name)),
    }));
    metrics = [field("Pendientes", result.metrics.action), field("Vencidas", result.metrics.overdue)];
    notice = "Hasta 100 tareas actuales y 50 históricas visibles para tu cuenta. Consulta sin sincronización ni escrituras.";
  } else if (key === "wallet") {
    const result = await getCurrentWallet({ provision: false });
    if (!result.schemaReady) throw new Error("Wallet no disponible.");
    const wallet = result.wallet;
    metrics = wallet ? [field("Saldo total", money(wallet.balance)), field("Titular", wallet.owner)] : [field("Wallet", "Todavía no tienes una wallet creada")];
    entries = wallet ? [
      ...wallet.accounts.map(account => entry(row(account), { id: `account-${account.id}`, title: account.name, subtitle: "Mi cuenta", status: "ACCOUNT", fields: [field("Saldo", money(account.balance)), field("Tipo", account.kind), field("Meta", account.savingsGoal ? money(account.savingsGoal) : "Sin meta")] })),
      ...wallet.entries.map(item => entry(row(item), { title: money(item.amount), subtitle: item.description || item.type, status: item.type, date: item.occurredAt, fields: [field("Cuenta", item.accountName), field("Descripción", item.description), field("Tipo", item.type)] })),
    ] : [];
    entries.push(...result.legacyHistory.map(item => entry(row(item), { id: `legacy-${item.id}`, title: money(item.amount), subtitle: item.description || "Movimiento anterior", status: item.status || "HISTORICAL", date: item.occurredAt, fields: [field("Origen", "Historial anterior"), field("Tipo", item.type)] })));
    notice = "Solo tus cuentas y hasta 100 movimientos actuales más 100 del historial anterior. Los saldos son los registrados por el sistema.";
  } else if (key === "configuracion") {
    entries = rows(data(await getBranchesAction())).map(item => entry(item, {
      title: text(item.name), code: text(item.code), subtitle: text(item.address),
      fields: [field("Código", item.code), field("Dirección", item.address), field("Teléfono", item.phone)],
    }));
    notice = "Directorio de sucursales. La gestión de usuarios y permisos continúa en Configuración Web.";
  }

  if (!alreadyPaged && query) {
    const normalized = query.toLocaleLowerCase("es");
    entries = entries.filter(item => [item.title, item.subtitle, item.code, item.imei, ...item.fields.map(f => f.value), ...item.lines.flatMap(line => [line.title, line.subtitle])].some(value => value?.toLocaleLowerCase("es").includes(normalized)));
  }
  const start = (page - 1) * 20;
  const hasMore = alreadyPaged ? page * 20 < (total ?? 0) : entries.length > start + 20;
  return {
    module: key, title: WORKSPACE_MODULES.find(module => module.key === key)!.name,
    entries: alreadyPaged ? entries : entries.slice(start, start + 20), metrics, page, hasMore, notice, fetchedAt: new Date().toISOString(),
  };
}
