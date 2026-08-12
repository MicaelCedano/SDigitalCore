# Fase 0A — Auditoría de SDigitalCore para QC

**Fecha:** 2026-08-11
**Alcance:** revisión de SDigitalCore únicamente.
**Estado:** completada como auditoría; no se modificó código de negocio ni la base de datos.

## 1. Resumen ejecutivo

SDigitalCore ya tiene una base operativa real para autenticación, permisos, auditoría, almacén, recibos de mercancía, conteos, garantías, facturas y listas de precios.

Sin embargo, todavía no tiene el flujo nativo de QC que combina revisión de equipos, pago al personal que revisa y un documento operativo propio para registrar la recepción de compras. QC no debe construirse directamente sobre `WarehouseProduct`, `GoodsReceiptItem` o `WarrantyCase`. Primero debe definirse el modelo propio de recepción/QC y sus relaciones con los equipos revisados.

El recibo actual de almacén no debe asumirse como el documento correcto para compras QC. Su nombre, campos y propósito son distintos; el documento nuevo debe recibir un nombre alineado con la operación real, que se confirmará durante la auditoría funcional de SDigitalSystem.

El documento anterior `docs/arquitectura/estado-actual.md` está desactualizado: declara que Core está en una Fase 1 mínima, pero el repositorio ya contiene módulos de almacén, garantías, facturas, precios, usuarios persistidos y migraciones operativas recientes.

## 2. Stack y arquitectura confirmados

- Next.js 16.3 App Router.
- React 19.2.
- TypeScript estricto.
- Prisma 7.9 con PostgreSQL/Supabase.
- Auth.js/NextAuth 5 beta.
- Zod 4.
- Supabase Storage.
- Vercel.
- Módulos organizados bajo `modules/<modulo>`.
- Server Actions protegidas por `requireUser()` y `requirePermission()`.
- Fechas almacenadas como `DateTime`; la presentación usa utilidades de zona horaria.

La estructura nativa que QC debe seguir es:

```text
modules/qc/
  actions/
  components/
  lib/
  validation/
app/(dashboard)/qc/
```

No se debe crear una aplicación, autenticación, base de datos o sistema de permisos paralelo.

## 3. Entidades existentes relevantes

### Reutilizables directamente

| Entidad | Uso posible en QC | Observación |
|---|---|---|
| `User` | QC responsable, administrador, supervisor | Tiene `roleCode`, `allowedModules`, `status` y relaciones de auditoría. |
| `AuditLog` | Auditoría de lotes, inspecciones y decisiones | Tiene índices por usuario, módulo y entidad. |
| `GoodsReceipt` | Referencia para comparar el concepto de entrada | Es un recibo de almacén y no debe reutilizarse automáticamente como documento de compras QC. |
| `GoodsReceiptItem` | Referencia de líneas, cantidad, descripción e IMEI/serie | `imeiOrSerial` es texto libre; no representa el flujo de compra, revisión y pago QC. |
| `CatalogModel` | Catálogo básico de modelos | Puede servir como referencia temporal, sujeto a revisión. |
| `Branch` | Sucursal de recepción o destino | Reutilizable. |
| `WarrantyCase` | Flujo posterior para equipos defectuosos o garantías | No debe usarse como registro primario de inventario QC. |
| `WarrantyEvent` | Historial de casos de garantía | Reutilizable únicamente después de una transición explícita a garantías. |
| `OperationalDailySequence` | Códigos diarios | Puede soportar códigos QC, evitando otra secuencia paralela. |
| `Notification` | Avisos operativos | Debe ampliarse para eventos QC si el contrato actual lo permite. |

### No reutilizables como modelo QC principal

| Entidad | Razón |
|---|---|
| `WarehouseProduct` | Está diseñada para stock agregado de cajas/unidades, no para equipos con IMEI. |
| `WarehouseMovement` | Registra movimientos agregados de productos, no la transición individual de cada equipo. |
| `StockCountItem` | Guarda IMEIs escaneados como texto, pero no mantiene expediente individual. |
| `WarrantyCase` | Representa un caso de garantía, no una inspección de compra. |
| `InvoiceItem` | Su campo de IMEIs sirve para documentos, no para inventario operacional. |
| `PriceListItem` | Es catálogo/precio y no debe convertirse en inventario serializado. |

## 4. Capacidades de infraestructura disponibles

### Autenticación y autorización

Disponible:

- `requireUser()`.
- `requirePermission(permission)`.
- `can(permission)`.
- Lectura del usuario persistido desde PostgreSQL.
- Bloqueo de usuarios que no estén `ACTIVE`.
- `allowedModules` persistido por usuario.
- Roles definidos: `ADMIN`, `ALMACEN`, `VENTAS`, `TECNICO`, `QC`, `SUPERVISOR` y `PERSONALIZADO`.

Hallazgo relevante:

- El rol `QC` existe, pero `DEFAULT_ROLE_MODULES.QC` está vacío.
- `SYSTEM_MODULES` todavía no contiene el módulo `qc`.
- Los permisos se resuelven actualmente por módulo permitido, no por una tabla granular de permisos.
- Hay que agregar QC al sistema de módulos y definir sus permisos sin convertir el rol QC en administrador.

### Validación

Disponible:

- Schemas Zod centralizados para garantías, almacén, recibos, inventario de almacén, perfiles y facturas.
- Validaciones de IMEI de 15 dígitos en garantías.
- Validaciones de cantidades, estados y campos obligatorios.

Pendiente para QC:

- Schema de lote QC.
- Schema de inspección.
- Schema de checklist versionada.
- Schema de adjuntos.
- Reglas de transición de estados.
- Validación anti-duplicación de equipo en lotes activos.

### Auditoría

Disponible:

- `AuditLog` persistente.
- `logAudit()` en `lib/audit/index.ts`.
- Uso comprobado en garantías, almacén, facturas, configuración y perfiles.
- Campos `beforeData` y `afterData`.

Regla para QC:

- Crear auditoría de creación, asignación, inicio, inspección, corrección, entrega, aprobación, devolución, cancelación y cualquier cambio de resultado.
- No guardar fotos, secretos ni información innecesaria dentro de `beforeData`/`afterData`.

### Storage

Disponible:

- `uploadFile()` con Supabase Service Role únicamente en servidor.
- `getPublicUrl()` para archivos públicos.
- Protección contra uso del cliente Service Role.

Riesgo para QC:

- `getPublicUrl()` no es adecuado para fotos sensibles de defectos si el bucket es público.
- QC debe definir bucket privado, rutas por entidad y URLs firmadas o endpoint server-side antes de subir evidencia real.

## 5. Rutas operativas existentes

### Implementadas

- `/dashboard`
- `/almacen`
- `/almacen/recibos`
- `/almacen/movimientos`
- `/almacen/conteos`
- `/almacen/transferencias`
- `/garantias`
- `/garantias/ingreso`
- `/garantias/[caseCode]`
- `/garantias/despacho`
- `/garantias/historial/documentos`
- `/facturas`
- `/precios`
- `/configuracion`

### QC

- No existe todavía una ruta funcional `/qc` en Core.
- La ruta debe incorporarse después de cerrar el modelo de equipo y permisos.

## 6. Flujos que no se deben romper

1. Recibos de mercancía con sus líneas y estados `DRAFT`, `COMPLETED`, `CANCELLED`.
2. Movimientos y solicitudes de almacén con sus transacciones y auditoría.
3. Conteos de stock y sus IMEIs escaneados.
4. Casos de garantía, su máquina de estados y documentos.
5. Autenticación Auth.js/NextAuth.
6. Autorización basada en usuario persistido y `allowedModules`.
7. Auditoría central mediante `AuditLog`.
8. Uso de Supabase Service Role exclusivamente en servidor.
9. Secuencias y fechas presentadas en `America/Santo_Domingo`.

## 7. Conflictos y decisiones necesarias antes de la Fase 1

### Dependencia principal: revisión, pago y documento de compra QC

El núcleo del módulo no es únicamente almacenar equipos. El flujo debe representar:

1. Qué compra o recepción se está procesando.
2. Qué equipos fueron recibidos para revisión.
3. Qué persona de QC revisó cada equipo.
4. Qué resultado tuvo cada revisión.
5. Cuánto corresponde pagar por el trabajo realizado.
6. Qué documento operativo deja constancia de la recepción.

El pago debe quedar relacionado con el lote o jornada de revisión y no calcularse solamente desde una tarjeta del dashboard. La Fase 0B debe confirmar la tarifa, la unidad pagable, el momento de generación y el momento de aprobación del pago.

El documento de recepción de compras QC debe ser una entidad propia, con nombre y campos alineados a la operación de SDigitalSystem. No se reutilizará el nombre `GoodsReceipt` si ese nombre representa exclusivamente el recibo de almacén.

### Dependencia principal: equipo individualizado

Core necesita definir una entidad equivalente a:

```text
inventory_device
  id
  imei / serial
  modelo
  color
  origen de compra o recibo
  sucursal
  estado de inventario
  estado de archivo
  created_at / updated_at
```

QC debe referenciar esta entidad mediante una relación estable. No debe guardar únicamente el IMEI como texto dentro de una inspección.

### Compras QC y recibo operativo aún no representados

Core tiene recibos de almacén, pero no el documento operativo propio para la recepción de compras que alimenta el flujo QC. La Fase 0B debe confirmar el nombre real y si necesita:

- proveedor, compra, lote y fecha de recepción;
- líneas por modelo, cantidad, costo y equipos/IMEIs;
- estado de recepción y estado de revisión;
- vínculo con los pagos de quienes revisan;
- documento consultable o imprimible para la operación;
- integración posterior con inventario, garantías y almacén.

### Permisos QC incompletos

Antes de crear la ruta `/qc` se debe definir si Core conservará el esquema actual de `allowedModules` o si la Fase 1 de QC introducirá permisos granulares específicos. La decisión recomendada es mantener el mecanismo actual y añadir permisos QC explícitos de forma compatible.

## 8. Matriz preliminar de integración

| Área | Estado en Core | Acción recomendada |
|---|---|---|
| Usuarios y sesiones | Disponible | Reutilizar sin cambios estructurales. |
| Rol QC | Parcial | Activar módulo QC y permisos específicos. |
| Auditoría | Disponible | Reutilizar `AuditLog` y `logAudit`. |
| Notificaciones | Parcial | Reutilizar y agregar eventos QC. |
| Storage | Disponible con riesgo | Crear estrategia privada para fotos QC. |
| Recibo de almacén | Disponible | No reutilizarlo automáticamente como documento de compra QC. |
| Equipos/IMEI | Faltante | Diseñar entidad compartida antes del schema QC. |
| Recibo operativo de compra QC | Faltante | Definir nombre, campos y flujo en Fase 0B. |
| Compras | Faltante/parcial | Confirmar proveedor, lote, equipos y estados en Fase 0B. |
| Pagos de QC | Faltante | Diseñar relación entre revisión/lote y pago al personal. |
| Inventario serializado | Faltante | Resolver antes de asignar equipos a lotes. |
| Garantías | Disponible | Integrar defectuosos mediante transición explícita. |
| Secuencias | Disponible | Reutilizar `OperationalDailySequence` si aplica. |
| Zona horaria | Parcialmente disponible | Mantener UTC y presentación dominicana. |

## 9. Resultado de la Fase 0A

La Fase 0A queda completada como auditoría de Core.

La Fase 0B debe auditar SDigitalSystem contra estos puntos concretos:

1. Qué representa exactamente un equipo y su origen.
2. Qué campos del equipo necesita QC antes y después de inspeccionar.
3. Qué estados de inventario ocurren después de aprobar o rechazar.
4. Si los lotes QC nacen de compras, recibos o inventario disponible.
5. Qué información de pago y notificación es indispensable.
6. Qué fotografías requieren acceso privado.
7. Qué reglas de checklist son universales y cuáles son configurables.

Después de 0B se debe producir una decisión única de modelo antes de crear migraciones.

## Contrato de entrega

- **Fase completada:** 0A — Auditoría de SDigitalCore.
- **Archivos creados:** `docs/arquitectura/qc-fase-0a-core.md`.
- **Archivos modificados:** ninguno.
- **Migraciones generadas:** ninguna.
- **Variables nuevas:** ninguna.
- **Rutas o acciones añadidas:** ninguna.
- **Permisos implementados:** ninguno; se documentó la brecha existente.
- **Pruebas ejecutadas:** inspección estática de schema, rutas, acciones, validadores, auth, Storage y auditoría.
- **Errores o pendientes:** falta auditar SDigitalSystem y decidir la entidad compartida de equipos/IMEI.
- **Comando de verificación:** `git diff --check`.
