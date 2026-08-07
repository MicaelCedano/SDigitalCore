# Plan maestro de construcción — SDigitalSystem modular

## Objetivo

Construir SDigitalSystem por fases, con una sola aplicación y una sola base de datos central. Cada módulo tendrá sus propias tablas y lógica, pero compartirá usuarios, permisos, clientes, proveedores, productos, equipos, auditoría y configuraciones cuando corresponda.

El trabajo debe hacerse en orden. Ningún subagente debe intentar construir todos los módulos a la vez.

## Decisión principal de arquitectura

```text
Una aplicación Next.js
  ├── Inventario
  ├── Almacén
  ├── Ventas
  ├── Taller
  ├── RMA / Garantías
  ├── QC
  ├── Lista de precios
  ├── Facturas PDF
  ├── Clientes
  ├── Proveedores
  ├── Reportes
  └── Configuración

Una base central PostgreSQL en Supabase
  ├── Tablas centrales
  ├── Tablas por módulo
  ├── Relaciones entre módulos
  └── Auditoría global
```

No se crea una base de datos por módulo. Se crean migraciones y tablas separadas dentro de la misma base.

## Stack establecido

- Next.js con App Router.
- TypeScript, React y Tailwind CSS.
- Prisma como ORM y capa de acceso a datos.
- PostgreSQL administrado por Supabase.
- NextAuth/Auth.js para login, manteniendo compatibilidad con el SDigitalSystem actual.
- Supabase Storage para fotos, PDFs y archivos.
- Vercel para despliegue.
- Zod para validar formularios y Server Actions.
- Vitest/Jest para lógica y Playwright para flujos principales.

### Decisión sobre autenticación

El proyecto actual usa Prisma, Supabase en producción, Supabase Storage y NextAuth. Este plan mantiene NextAuth/Auth.js para no tener dos sistemas de autenticación.

- Login: NextAuth/Auth.js.
- Usuarios, roles y permisos: tablas propias en PostgreSQL.
- Consultas de negocio: Prisma desde el servidor.
- Archivos: Supabase Storage.
- `SUPABASE_SERVICE_ROLE_KEY`: únicamente en servidor.

No introducir Supabase Auth encima de NextAuth sin una decisión explícita de Micael.

## Reglas para todos los subagentes

1. Leer `AGENTS.md` del repositorio antes de trabajar.
2. Leer este documento antes de comenzar una fase.
3. Trabajar únicamente en la fase asignada.
4. No construir módulos futuros “para adelantar”.
5. No cambiar el stack sin aprobación.
6. No escribir directamente en la base de datos de producción.
7. Crear migraciones, pero dejar que Micael las aplique manualmente en Supabase.
8. No exponer claves secretas en el navegador.
9. No borrar tablas o columnas existentes sin confirmar el impacto.
10. Toda mutación debe validar sesión, permiso y datos de entrada.
11. Toda operación importante debe quedar en `audit_log`.
12. Cada fase termina con build, pruebas y resumen.
13. No mezclar refactors grandes con funcionalidades nuevas.
14. No hacer despliegues ni migraciones destructivas sin confirmación.

## Contrato de entrega de cada subagente

```text
Fase completada:
Archivos creados o modificados:
Migraciones generadas:
Variables de entorno nuevas:
Rutas o acciones añadidas:
Permisos implementados:
Pruebas ejecutadas:
Errores o pendientes:
Comando de verificación:
```

# Fase 0 — Descubrimiento y congelación de alcance

## Tareas

- Revisar estructura de carpetas y `package.json`.
- Revisar `prisma/schema.prisma`.
- Revisar `middleware.ts` o `proxy.ts`.
- Revisar NextAuth y todas las variables de entorno.
- Revisar rutas existentes y Server Actions.
- Identificar tablas y flujos que no se pueden romper.
- Identificar módulos que ya están en producción.
- Revisar bugs conocidos de autenticación, permisos y zona horaria.
- Crear inventario de deuda técnica.

## Entregable

Crear `docs/arquitectura/estado-actual.md` con stack real, tablas, roles, rutas, integraciones, riesgos y elementos que se preservan.

## No hacer todavía

- No crear tablas nuevas.
- No cambiar el login.
- No modificar datos de producción.
- No rehacer la UI completa.

# Fase 1 — Base del proyecto y configuración local

## Estructura recomendada

```text
app/(auth)/login
app/(auth)/recuperar-password
app/(dashboard)/dashboard
app/(dashboard)/inventario
app/(dashboard)/almacen
app/(dashboard)/ventas
app/(dashboard)/taller
app/(dashboard)/rma
app/(dashboard)/qc
app/(dashboard)/precios
app/(dashboard)/facturas
app/(dashboard)/clientes
app/(dashboard)/proveedores
app/(dashboard)/reportes
app/(dashboard)/configuracion
app/api
app/actions

components/ui
components/layout
components/auth
components/shared

lib/auth
lib/db
lib/permissions
lib/audit
lib/storage
lib/validation
lib/pdf

modules/inventario
modules/almacen
modules/ventas
modules/taller
modules/rma
modules/qc
modules/precios
modules/facturas
modules/clientes
modules/proveedores
modules/reportes
```

## Tareas

- Configurar alias de imports, TypeScript estricto y ESLint.
- Crear cliente Prisma singleton.
- Crear manejo centralizado de errores.
- Crear layout protegido del dashboard.
- Crear navegación lateral basada en permisos.
- Crear componentes reutilizables de tabla, formulario, modal, paginación, búsqueda y estado vacío.
- Crear toasts y mensajes de error consistentes.
- Guardar fechas en UTC y presentarlas en `America/Santo_Domingo`.

## Entregable

La aplicación debe abrir, mostrar login y permitir entrar a un dashboard vacío protegido.

# Fase 2 — Base central, sin módulos de negocio

Esta fase crea únicamente piezas compartidas por todo el sistema.

## Principios

- Una sola base PostgreSQL central.
- IDs UUID o cuid, elegidos una sola vez.
- Fechas en UTC.
- `created_at` y `updated_at` en las tablas principales.
- Soft delete donde se necesite conservar historial.
- Índices para búsquedas y relaciones.
- Restricciones únicas para códigos, emails, SKUs e IMEIs.
- Transacciones para operaciones que cambien varias tablas.
- Auditoría para acciones sensibles.

## Tablas centrales

### Organización

```text
organization
branch
warehouse_location
system_setting
number_sequence
```

### Usuarios y autenticación

```text
user
account
session
verification_token
role
permission
role_permission
user_role
user_branch
```

### Control global

```text
audit_log
notification
attachment
integration_setting
```

### Catálogos compartidos

```text
brand
device_model
category
product
product_variant
customer
supplier
employee_profile
```

## Campos mínimos

### `user`

`id`, `email` único, `name`, `password_hash` si aplica, `status`, `last_login_at`, `created_at`, `updated_at`.

### `role`

`id`, `code` único, `name`, `description`.

Ejemplos: `ADMIN`, `ALMACEN`, `VENTAS`, `TECNICO`, `QC`, `SUPERVISOR`.

### `permission`

`id`, `code` único, `module`, `action`.

Ejemplos: `inventory.read`, `inventory.write`, `rma.approve`.

### `audit_log`

`id`, `user_id`, `action`, `module`, `entity_type`, `entity_id`, `before_data`, `after_data`, `ip_address`, `user_agent`, `created_at`.

Nunca guardar contraseñas, tokens ni secretos en la auditoría.

## Entregables

- Schema Prisma documentado.
- Primera migración revisada.
- Seed local con organización, sucursal, roles, permisos y admin de prueba.
- Script para consultar estado de la base.
- Diagrama de relaciones.
- `docs/arquitectura/base-central.md`.

## Verificación

```bash
npx prisma validate
npx prisma generate
npm run build
```

# Fase 3 — Login, sesión y permisos

## Flujo

```text
/login
  ↓
NextAuth valida credenciales
  ↓
Se carga usuario activo desde PostgreSQL
  ↓
Se cargan roles y permisos
  ↓
Se crea sesión segura
  ↓
Middleware protege el dashboard
  ↓
Cada acción vuelve a validar el permiso en servidor
```

## Reglas

- No confiar solo en ocultar botones.
- Toda Server Action debe comprobar sesión y permiso.
- Usuario inactivo no puede entrar.
- Contraseñas con hash fuerte, nunca texto plano.
- Cookies `httpOnly` y `secure` en producción.
- Roles efectivos cargados desde servidor.
- Registrar login exitoso, fallido, logout y bloqueo.
- Implementar recuperación de contraseña antes de producción.
- Aplicar límite de intentos o protección contra abuso.

## Helpers obligatorios

```text
requireUser()
requireRole(role)
requirePermission(permission)
can(permission)
getCurrentUser()
```

## Pruebas mínimas

- Usuario sin sesión no entra al dashboard.
- Usuario sin permiso no puede ejecutar la acción por URL directa.
- Usuario inactivo no inicia sesión.
- Admin ve todos los módulos.
- Técnico solo ve sus módulos.
- Logout invalida la sesión.

# Fase 4 — Catálogos centrales

Crear los datos compartidos antes de crear operaciones:

- Marcas.
- Modelos.
- Categorías.
- Productos y variantes.
- Clientes.
- Proveedores.
- Sucursales y ubicaciones.
- Estados configurables cuando tenga sentido.

Cada catálogo debe tener CRUD protegido, búsqueda, paginación, validación Zod, auditoría y seed local. No borrar físicamente un catálogo usado por transacciones.

# Fase 5 — Inventario y equipos

## Tablas sugeridas

```text
inventory_item
device
device_imei
inventory_status_history
inventory_adjustment
inventory_attachment
```

## Reglas

- Un IMEI no puede duplicarse.
- Un equipo puede tener más de un IMEI cuando aplique, guardando el tipo.
- Cada movimiento deja historial.
- No cambiar stock directamente desde la interfaz.
- Toda entrada o salida usa una transacción.
- Las operaciones masivas validan cada fila.

## Entregable

Alta de equipos, importación de IMEIs, búsqueda por IMEI/SKU/marca/modelo, detalle, historial y estados: disponible, reservado, vendido, en reparación, defectuoso y archivado.

# Fase 6 — Almacén

## Tablas sugeridas

```text
stock_location
stock_balance
stock_movement
stock_transfer
stock_transfer_item
stock_count
stock_count_item
```

## Flujo

`Borrador → Solicitada → En tránsito → Recibida → Cerrada`.

La transferencia actualiza existencias solo en los estados correctos y dentro de una transacción.

# Fase 7 — Clientes y proveedores

- CRUD de clientes.
- Historial de compras y reparaciones.
- CRUD de proveedores.
- Contactos y teléfonos.
- Notas internas.
- Estado activo/inactivo.
- Protección de datos personales.
- Búsqueda por nombre, teléfono, email y documento.

No duplicar el cliente dentro de Ventas, Taller o RMA. Esos módulos deben referenciar `customer_id`.

# Fase 8 — Lista de precios

## Tablas sugeridas

```text
price_list
price_list_item
price_rule
```

Una lista puede ser general, mayorista, técnica o personalizada. Registrar vigencia y no sobrescribir el historial. Ventas debe guardar el precio usado en la transacción.

# Fase 9 — Ventas

## Tablas sugeridas

```text
quotation
quotation_item
sales_order
sales_order_item
sale
sale_item
payment
payment_method
sale_status_history
```

## Flujo

`Borrador → Cotización → Confirmada → Pagada parcial → Pagada → Entregada → Cancelada`.

## Reglas

- No vender stock inexistente.
- Evitar doble descuento de inventario.
- Cancelar mediante operación compensatoria, no borrando la venta.
- Registrar usuario que confirma y entrega.
- Validar pagos y diferencias.

# Fase 10 — Taller y reparaciones

## Tablas sugeridas

```text
repair_order
repair_device
repair_status_history
repair_diagnosis
repair_action
repair_part
repair_assignment
repair_delivery
```

## Estados

`Recibido → En diagnóstico → Esperando aprobación → En reparación → Esperando repuesto → Listo para entregar → Entregado/Cancelado`.

El Taller no depende obligatoriamente de Inventario. Puede vincular un equipo interno cuando exista, pero también aceptar equipos externos.

# Fase 11 — RMA y Garantías

## Tablas sugeridas

```text
rma_case
rma_item
rma_diagnosis
rma_resolution
rma_status_history
rma_attachment
```

## Flujo

`Solicitud → Recibido → En diagnóstico → Aprobado/Rechazado → Resolución → Cerrado`.

La garantía puede buscar factura, cliente e IMEI. Un equipo externo debe poder registrarse sin factura interna. No cerrar un caso sin resolución. Guardar evidencia en Storage.

# Fase 12 — Control de calidad (QC)

## Tablas sugeridas

```text
qc_checklist
qc_checklist_item
qc_inspection
qc_inspection_result
qc_batch
qc_batch_item
```

La checklist debe ser versionable. Guardar la versión usada en cada inspección. No modificar una inspección cerrada; crear una corrección auditada. Separar estado del equipo de resultado QC.

# Fase 13 — Facturas PDF y documentos

## Tablas sugeridas

```text
document_template
generated_document
document_sequence
```

- Generar PDF en servidor.
- Guardar referencia al origen y al documento.
- Usar Storage para archivos finales, no columnas `bytea` grandes.
- Una factura emitida no se edita silenciosamente.
- Verificar visualmente PDFs antes de entregarlos.

# Fase 14 — Reportes y dashboard

Implementar ventas por período, stock, almacén, RMA abiertos, reparaciones, QC, productos vendidos, compras y auditoría.

Usar consultas agregadas y paginación. No hacer cientos de consultas por cada fila del dashboard. Los reportes pesados deben ser consultas específicas o vistas seguras.

# Fase 15 — Configuración del sistema

## Configuraciones

```text
Nombre de empresa
Logo
Moneda
Zona horaria
Formato de numeración
Prefijo de facturas
Impuesto
Métodos de pago
Estados activos
Plantillas de documentos
Sucursales
Permisos por rol
Configuración de correo
Configuración de Storage
Integraciones externas
```

## Reglas

- Configuración con nombre, tipo, valor y descripción.
- No guardar secretos en `system_setting`.
- Secretos solo en variables de entorno.
- Cambios de configuración auditados.
- Configuración administrativa protegida por permisos.

# Login y variables de entorno

## `.env.local`

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="secret-largo-local"
NEXT_PUBLIC_SUPABASE_URL="https://...supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_CHAT_ID="..."
TELEGRAM_ADMIN_CHAT_ID="..."
```

## Reglas

- `.env.local` nunca se commitea.
- `NEXT_PUBLIC_*` es público.
- `SUPABASE_SERVICE_ROLE_KEY` solo servidor.
- `NEXTAUTH_SECRET` cambia entre local, preview y producción.
- Las claves de producción se configuran en Vercel.
- Preview nunca debe apuntar accidentalmente a producción.

## Supabase

- Un proyecto principal para producción.
- Una base local o proyecto separado para pruebas destructivas.
- Storage para PDFs, fotos y documentos.
- Buckets privados para archivos sensibles.
- Políticas de Storage por usuario/rol.
- No usar service role desde el cliente.
- Monitorear tamaño de base, Storage, egress y pausas por inactividad.

# Estrategia de migraciones

```text
Subagente modifica schema.prisma
        ↓
Genera migración local
        ↓
Ejecuta validate/generate y pruebas
        ↓
Entrega SQL/migración a Micael
        ↓
Micael revisa y aplica manualmente en Supabase
        ↓
Se verifica en producción
```

## Prohibido

- `prisma migrate deploy` contra producción sin autorización.
- SQL destructivo automático.
- `db push` en producción.
- Cambiar una migración ya aplicada.
- Borrar datos para que pase una prueba.

Cada migración debe incluir nombre descriptivo, tablas afectadas, índices, restricciones, datos iniciales, plan de reversión, riesgo y consulta de verificación.

# Seguridad mínima antes de producción

- RLS activo en tablas expuestas por Data API.
- Políticas revisadas por tabla.
- No usar `user_metadata` para autorización.
- Validar permisos en servidor.
- Evitar IDOR/BOLA al consultar por ID.
- Revisar uploads, extensiones y tamaños.
- No guardar secretos en logs.
- Revisar rate limits del login y endpoints públicos.
- Validar webhooks con firma o secreto.
- Auditar acciones administrativas.
- Probar usuarios de cada rol.

# Pruebas por fase

## Unitarias

Validadores Zod, cálculos, permisos, transiciones de estados, fechas y moneda.

## Integración

Server Actions autenticadas, Prisma, transacciones, restricciones únicas y auditoría.

## Interfaz

Login, navegación por rol, crear/editar/cancelar, errores, estados vacíos, búsqueda, paginación y móvil.

## Seguridad

Acceso directo a URLs, acciones sin sesión, rol incorrecto, modificar otro registro, archivo no permitido y doble envío de operaciones sensibles.

# Orden recomendado de subagentes

```text
1. Auditoría del proyecto
2. Estructura y configuración
3. Base central
4. Login y permisos
5. Catálogos
6. Inventario
7. Almacén
8. Clientes y proveedores
9. Lista de precios
10. Ventas
11. Taller
12. RMA y garantías
13. QC
14. Facturas PDF
15. Reportes
16. Configuración
17. Seguridad, pruebas y despliegue
```

No es necesario crear 17 agentes simultáneos. Lo importante es respetar el orden y no iniciar una fase hasta que la anterior tenga build, pruebas y resumen de entrega.

# Criterio final de terminado

- Existe una sola base central documentada.
- El login protege todas las rutas.
- Los roles y permisos se validan en servidor.
- Cada módulo tiene tablas y migraciones propias.
- No se duplican clientes, productos ni equipos.
- Operaciones críticas usan transacciones.
- Acciones importantes dejan auditoría.
- PDFs y fotos usan Storage.
- Variables de entorno están separadas por ambiente.
- Migraciones de producción fueron revisadas y aplicadas manualmente.
- Hay pruebas para los flujos principales.
- El build de producción pasa.
- El sistema fue probado con cada rol.
- Se revisaron los límites de Vercel y Supabase antes de abrirlo a usuarios reales.

## Fuentes técnicas

- [Supabase — Pricing y límites](https://supabase.com/pricing)
- [Supabase — tamaño de base de datos](https://supabase.com/docs/guides/platform/database-size)
- [Supabase — seguridad de Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase — Storage](https://supabase.com/docs/guides/storage)
- [NextAuth/Auth.js](https://authjs.dev/)
- [Prisma — PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Vercel — Pricing](https://vercel.com/pricing)
- [Vercel — términos Hobby](https://vercel.com/legal/terms)
