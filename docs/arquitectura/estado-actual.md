# Estado actual del proyecto — SDigitalCore

**Fecha de creación:** 2026-08-07  
**Fase:** 1 — Base del proyecto y configuración  
**Estado:** En construcción

---

## Stack

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 15.x | Framework principal — App Router |
| React | 19.x | UI |
| TypeScript | 5.x (strict) | Tipado |
| Tailwind CSS | 4.x | Estilos |
| Prisma | 6.x | ORM |
| PostgreSQL | — | Base de datos (Supabase) |
| NextAuth/Auth.js | v5 beta | Autenticación |
| Supabase | — | Storage y DB hosting |
| Zod | — | Validación |
| Vercel | — | Despliegue |

---

## Estructura de carpetas

```
app/(auth)/            — Login, recuperar contraseña
app/(dashboard)/       — Módulos protegidos (12 módulos)
app/api/auth/          — Route handler NextAuth
app/page.tsx           — Redirige a /dashboard

components/auth/       — LoginForm
components/layout/     — Sidebar, Topbar
components/ui/         — Componentes reutilizables (pendiente)
components/shared/     — SearchInput, ConfirmDialog (pendiente)

lib/auth/              — config.ts (NextAuth), helpers.ts, index.ts
lib/db/                — Prisma singleton
lib/audit/             — logAudit() placeholder
lib/storage/           — Supabase Storage helpers
lib/validation/        — Schemas Zod
lib/utils/             — format.ts (fechas, moneda)
lib/pdf/               — Placeholder Fase 13

modules/               — Directorios por módulo (pendiente estructura interna)
prisma/                — schema.prisma (tablas NextAuth mínimas)
docs/                  — Documentación de arquitectura
```

---

## Tablas existentes (Fase 1 — mínimas para NextAuth)

| Tabla | Descripción |
|---|---|
| `user` | Usuarios del sistema |
| `account` | Cuentas OAuth vinculadas |
| `session` | Sesiones activas |
| `verification_token` | Tokens de verificación |

> **Nota:** Las tablas centrales de negocio se crean en Fase 2.

---

## Rutas implementadas

| Ruta | Protección | Estado |
|---|---|---|
| `/` | — | Redirige a `/dashboard` |
| `/login` | Pública | ✅ Implementada |
| `/recuperar-password` | Pública | 🔲 Placeholder |
| `/dashboard` | Auth requerida | ✅ Implementada |
| `/inventario` | Auth requerida | 🔲 Placeholder Fase 5 |
| `/almacen` | Auth requerida | 🔲 Placeholder Fase 6 |
| `/ventas` | Auth requerida | 🔲 Placeholder Fase 9 |
| `/taller` | Auth requerida | 🔲 Placeholder Fase 10 |
| `/rma` | Auth requerida | 🔲 Placeholder Fase 11 |
| `/qc` | Auth requerida | 🔲 Placeholder Fase 12 |
| `/clientes` | Auth requerida | 🔲 Placeholder Fase 7 |
| `/proveedores` | Auth requerida | 🔲 Placeholder Fase 7 |
| `/precios` | Auth requerida | 🔲 Placeholder Fase 8 |
| `/facturas` | Auth requerida | 🔲 Placeholder Fase 13 |
| `/reportes` | Auth requerida | 🔲 Placeholder Fase 14 |
| `/configuracion` | Auth requerida | 🔲 Placeholder Fase 15 |
| `/api/auth/[...nextauth]` | Pública | ✅ Implementada |

---

## Autenticación — Fase 1

- **Fase 1:** Usuario de prueba hardcodeado (`admin@sdigital.local` / `Admin1234!`) solo en desarrollo.
- **Fase 3:** Credenciales reales con hash bcrypt, usuarios en PostgreSQL.
- **Permisos:** Pendiente Fase 3 — `can()` y `requirePermission()` retornan placeholder.

---

## Variables de entorno necesarias

Ver `.env.example` para la lista completa.

| Variable | Estado |
|---|---|
| `DATABASE_URL` | Placeholder — configurar con Supabase |
| `DIRECT_URL` | Placeholder — configurar con Supabase |
| `AUTH_SECRET` | Placeholder — generar secreto real |
| `NEXT_PUBLIC_SUPABASE_URL` | Placeholder |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Placeholder |
| `SUPABASE_SERVICE_ROLE_KEY` | Placeholder |

---

## Módulos planificados

| Módulo | Fase | Estado |
|---|---|---|
| Base del proyecto | 1 | ✅ En curso |
| Base central DB | 2 | 🔲 Pendiente |
| Login y permisos | 3 | 🔲 Pendiente |
| Catálogos | 4 | 🔲 Pendiente |
| Inventario | 5 | 🔲 Pendiente |
| Almacén | 6 | 🔲 Pendiente |
| Clientes y Proveedores | 7 | 🔲 Pendiente |
| Lista de Precios | 8 | 🔲 Pendiente |
| Ventas | 9 | 🔲 Pendiente |
| Taller | 10 | 🔲 Pendiente |
| RMA y Garantías | 11 | 🔲 Pendiente |
| QC | 12 | 🔲 Pendiente |
| Facturas PDF | 13 | 🔲 Pendiente |
| Reportes | 14 | 🔲 Pendiente |
| Configuración | 15 | 🔲 Pendiente |

---

## Riesgos identificados

- El `.env.local` tiene placeholders — la app no puede conectar a BD hasta configurar Supabase.
- NextAuth v5 (beta) puede tener cambios de API antes de estable.
- Las migraciones no se aplican hasta que Micael las revise y ejecute manualmente en Supabase.
- El schema Prisma de Fase 1 es mínimo — no ejecutar `prisma migrate deploy` en producción.

---

## Reglas que no se deben romper

1. No introducir Supabase Auth — usar NextAuth.
2. No exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente.
3. No escribir directamente en producción.
4. No borrar tablas sin confirmar impacto.
5. Toda mutación debe validar sesión + permiso + Zod.
