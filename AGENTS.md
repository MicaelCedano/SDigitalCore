# SDigitalCore — Guía para agentes de codificación

## Reglas generales

Regla obligatoria de codificacion: todo archivo de codigo, texto y contenido visible debe conservarse en UTF-8. Nunca introducir ni aceptar mojibake o caracteres de reemplazo; antes de entregar, buscar secuencias de codificacion corrupta y corregirlas.

1. Leer `plan-sdigital-system-modular.md` antes de comenzar cualquier fase.
2. Trabajar únicamente en la fase asignada. No construir módulos futuros para adelantar.
3. No cambiar el stack sin aprobación de Micael.
4. No escribir directamente en la base de datos de producción.
5. Crear migraciones, pero dejar que Micael las aplique manualmente en Supabase.
6. No exponer claves secretas (`SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, etc.) en el navegador.
7. No borrar tablas o columnas existentes sin confirmar el impacto.
8. Toda mutación debe validar sesión, permiso y datos de entrada con Zod.
9. Toda operación importante debe quedar registrada en `audit_log`.
10. Cada fase termina con `npm run build`, pruebas y resumen de entrega.
11. No mezclar refactors grandes con funcionalidades nuevas.
12. No hacer despliegues ni migraciones destructivas sin confirmación.

## Stack

- **Framework**: Next.js 15 con App Router
- **Lenguaje**: TypeScript estricto
- **Estilos**: Tailwind CSS v4
- **ORM**: Prisma con PostgreSQL (Supabase)
- **Auth**: NextAuth/Auth.js v5 (beta)
- **Validación**: Zod
- **Storage**: Supabase Storage
- **Despliegue**: Vercel

## Estructura de carpetas

```
app/(auth)/          — Login, recuperar contraseña
app/(dashboard)/     — Módulos protegidos
app/api/             — Route handlers
app/actions/         — Server Actions

components/ui/       — Componentes base reutilizables
components/layout/   — Sidebar, Topbar, DashboardLayout
components/auth/     — LoginForm
components/shared/   — SearchInput, ConfirmDialog

lib/auth/            — requireUser, requirePermission, can, getCurrentUser
lib/db/              — Prisma singleton
lib/audit/           — logAudit()
lib/permissions/     — Helpers de permisos
lib/storage/         — Supabase Storage client
lib/validation/      — Schemas Zod compartidos
lib/pdf/             — Generación de PDFs

modules/             — Lógica de negocio por módulo

prisma/              — schema.prisma, migrations, seed
docs/                — Documentación de arquitectura
```

## Autenticación

- Login: NextAuth/Auth.js v5
- Usuarios, roles y permisos: tablas propias en PostgreSQL
- Consultas de negocio: Prisma desde el servidor
- `SUPABASE_SERVICE_ROLE_KEY`: únicamente en servidor
- **No introducir Supabase Auth** sin decisión explícita de Micael

## Helpers de auth obligatorios

```ts
requireUser()          // Exige sesión activa, lanza error si no hay
requirePermission(p)   // Exige permiso específico
can(permission)        // Retorna boolean sin lanzar error
getCurrentUser()       // Retorna user o null
```

## Fechas

- Siempre guardar en UTC en la base de datos.
- Presentar en la UI con zona `America/Santo_Domingo`.

## Contrato de entrega de cada fase

```
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

## Migraciones — Prohibido

- `prisma migrate deploy` contra producción sin autorización
- SQL destructivo automático
- `db push` en producción
- Cambiar una migración ya aplicada
- Borrar datos para que pase una prueba

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
