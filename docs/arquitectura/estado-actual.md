# Estado actual del proyecto — SDigitalCore

**Fecha de actualización:** 2026-08-15
**Fase:** Endurecimiento, validación y preparación de release
**Estado:** En construcción operativa; producción requiere reconciliación de migraciones y QA autenticado

---

## Stack

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 16.3.0 | Framework principal — App Router y `proxy.ts` |
| React | 19.x | UI |
| TypeScript | 5.x (strict) | Tipado |
| Tailwind CSS | 4.x | Estilos |
| Prisma | 7.9.1 | ORM y PostgreSQL adapter |
| PostgreSQL | — | Base de datos (Supabase) |
| NextAuth/Auth.js | v5 beta | Autenticación |
| Supabase | — | Storage y DB hosting |
| Zod | — | Validación |
| Vercel | — | Despliegue |

---

## Estructura de carpetas

```
app/(auth)/            — Login, recuperar contraseña
app/(dashboard)/       — Módulos protegidos operativos
app/api/auth/          — Route handler NextAuth
app/page.tsx           — Redirige a /dashboard

components/auth/       — LoginForm
components/layout/     — Sidebar, Topbar
components/ui/         — Componentes reutilizables
components/shared/     — Componentes compartidos

lib/auth/              — config.ts (NextAuth), helpers.ts, index.ts
lib/db/                — Prisma singleton
lib/audit/             — logAudit() y trazabilidad de operaciones
lib/storage/           — Supabase Storage helpers
lib/validation/        — Schemas Zod
lib/utils/             — format.ts (fechas, moneda)
lib/pdf/               — Utilidades de documentos

modules/               — Almacén, garantías, QC, reparaciones, desbloqueos, wallet, precios, facturas y centro de trabajo
prisma/                — schema.prisma, migraciones Prisma y SQL histórico declarado
docs/                  — Documentación de arquitectura
```

---

## Tablas existentes

| Tabla | Descripción |
|---|---|
| `user` | Usuarios, roles persistidos y módulos autorizados |
| `account` | Cuentas OAuth vinculadas |
| `session` | Sesiones activas |
| `verification_token` | Tokens de verificación |
| `warranty_case`, `warranty_event`, `warranty_document` | Flujo nativo de garantías |
| `device_unit`, `qc_inspection`, `qc_revision_batch` | Compras y control de calidad |
| `repair_job`, `repair_job_item`, `unlock_request`, `unlock_record` | Reparaciones y desbloqueos |
| `work_task`, `work_task_event`, `work_task_assignee` | Centro de trabajo global |

> **Nota:** El schema actual contiene módulos operativos. La aplicación de migraciones en producción debe verificarse contra `_prisma_migrations` y el catálogo real.

---

## Rutas activas principales

| Ruta | Protección | Estado |
|---|---|---|
| `/` | — | Redirige a `/dashboard` |
| `/login` | Pública | ✅ Implementada |
| `/recuperar-password` | Pública | 🔲 Placeholder |
| `/dashboard` | Auth requerida | ✅ Resumen operativo |
| `/almacen` | Auth + permisos | ✅ Recibos, stock y transferencias |
| `/garantias` | Auth + permisos | ✅ Ingreso, flujos, documentos e historial |
| `/qc` | Auth + permisos | ✅ Compras, lotes, revisiones, pagos y solicitudes |
| `/reparaciones` | Auth + permisos | ✅ Cola paginada y reporte de trabajos |
| `/desbloqueos` | Auth + permisos | ✅ Solicitudes y pagos |
| `/wallet` | Auth + permisos | ✅ Wallet y retiros |
| `/precios` | Auth + permisos | ✅ Lista de precios |
| `/facturas` | Auth + permisos | ✅ Facturas y conduces |
| `/centro-trabajo` | Auth + permisos | ✅ Bandeja operativa global |
| `/configuracion` | Auth + permisos | ✅ Usuarios, sucursales y configuración QC |
| `/api/search/imei` | Sesión + módulos autorizados | ✅ Búsqueda global paginada |
| `/api/auth/[...nextauth]` | Pública | ✅ Implementada |

---

## Autenticación y permisos

- Credenciales reales con hash, usuarios y estado en PostgreSQL.
- NextAuth/Auth.js v5 usa sesión JWT persistente; la autorización se vuelve a comprobar contra el usuario persistido.
- Las Server Actions usan `requirePermission(...)`, Zod, transacciones cuando corresponde y `audit_log` para mutaciones importantes.

---

## Variables de entorno necesarias

Ver `.env.example` para la lista completa.

| Variable | Estado |
|---|---|
| `DATABASE_URL` | Placeholder — configurar con Supabase |
| `DIRECT_URL` | Placeholder — configurar con Supabase |
| `AUTH_SECRET` | Configurar un secreto real por ambiente |
| `NEXT_PUBLIC_SUPABASE_URL` | Placeholder |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Placeholder |
| `SUPABASE_SERVICE_ROLE_KEY` | Placeholder |

---

## Módulos y estado

| Módulo | Fase | Estado |
|---|---|---|
| Base del proyecto y autenticación | 1–3 | ✅ Operativa |
| Almacén y catálogo de precios | 4–8 | ✅ Operativo |
| Garantías, reparaciones y desbloqueos | 10–11 | ✅ Operativos |
| QC y pagos | 12 | ✅ Operativo |
| Facturas, dashboard y centro de trabajo | 13–14 | ✅ Operativos |
| Configuración y endurecimiento | 15+ | 🟡 En curso |

---

## Riesgos identificados

- La aplicación local requiere `.env.local` y dependencias instaladas para ejecutar checks completos.
- NextAuth v5 (beta) puede tener cambios de API antes de estable.
- Existen 13 SQL históricos declarados en `prisma/manual-migrations.json`; su estado real debe compararse con `_prisma_migrations` antes de reconciliar o aplicar DDL.
- No ejecutar `prisma migrate deploy`, `db push` ni SQL manual en producción sin esa verificación.

---

## Reglas que no se deben romper

1. No introducir Supabase Auth — usar NextAuth.
2. No exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente.
3. No escribir directamente en producción.
4. No borrar tablas sin confirmar impacto.
5. Toda mutación debe validar sesión + permiso + Zod.
