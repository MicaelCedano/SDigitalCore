# Reconciliación de SQL histórico

`prisma/migrations` contiene migraciones Prisma ejecutables y 13 archivos SQL históricos que fueron conservados fuera del historial estándar de Prisma. El manifiesto `prisma/manual-migrations.json` y `npm run db:check-migrations` hacen explícita esa excepción y fallan si aparece un SQL nuevo sin registrar.

Esto no afirma que esos SQL estén aplicados en producción. Tampoco deben convertirse automáticamente en carpetas ejecutables: algunos pudieron aplicarse manualmente y repetirlos puede fallar o producir drift.

## Paso de producción pendiente

Después de validar localmente, ejecutar únicamente consultas de lectura en la base objetivo:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'device_photo', 'penalty', 'qc_revision_batch', 'qc_imei_request',
    'qc_model_image', 'repair_job', 'repair_job_item',
    'technician_repair_rate', 'unlock_request', 'unlock_record',
    'wallet_ledger_entry'
  )
ORDER BY table_name;
```

Comparar los objetos reales, columnas, índices y restricciones con cada SQL manual y con `prisma/schema.prisma`. Si un objeto existe pero no tiene una entrada histórica equivalente, documentar la evidencia y reconciliar el historial mediante el procedimiento aprobado para ese entorno. Si falta un objeto, preparar una migración aditiva revisada y aplicarla manualmente; no usar `db push`, no borrar datos y no ejecutar `prisma migrate deploy` a ciegas.

Hasta completar esa comprobación, el guard de migraciones debe seguir pasando con `status=requires-production-reconciliation`. Cambiar ese estado requiere evidencia de producción, no solo que el build local pase.
