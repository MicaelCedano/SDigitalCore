# Migración de equipos revisados y proveedores QC

## Alcance

- Lee proveedores, equipos e historial de revisiones desde SDigitalSystem sin escribir en su base de datos.
- Importa proveedores QC con identidad externa estable.
- Importa un `DeviceUnit` y la última inspección válida por cada equipo con historial `Revisado`.
- Crea un `qc_revision_batch` por cada compra de SDigitalSystem (80 lotes), con su proveedor, fecha de compra y conteos; cada equipo queda asociado al lote de su compra.
- Conserva IMEI, marca, modelo, almacenamiento, color, grado, observación, resultado y fecha.
- Recupera el último revisor identificado de Control de Calidad, ignorando eventos
  `Revisado` atribuidos a `ADMIN`/`ADMINISTRADOR`; así una verificación administrativa
  posterior no reemplaza al QC que hizo la revisión.
- Enlaza `reviewer_id` solo cuando la identidad legacy fue confirmada en Core; siempre conserva `reviewer_name_snapshot`.
- Conserva como `UNSPECIFIED` los equipos revisados cuya funcionalidad histórica esté vacía, sin inventar un resultado.
- Usa `source_system + source_record_id` para permitir reejecuciones idempotentes.

## Orden operativo

1. Aplicar en Supabase las migraciones en orden:
   - `20260811150000_add_qc_reviewed_devices` (tablas `device_unit` y `qc_inspection` + enums)
   - `20260811210000_add_qc_suppliers` (tabla `qc_supplier`)
   - `20260811233000_add_legacy_identity_wallet_bridge` (tabla `legacy_user_identity`, enlaza revisores)
   - `20260812_add_qc_revision_batch.sql` (tabla `qc_revision_batch` + `batch_id` en `device_unit`)
   - `20260812170000_add_legacy_qc_traceability` (columnas `source_system`/`source_record_id`)
   - `20260812183000_add_unspecified_qc_result` (valor de enum `UNSPECIFIED`)
2. Configurar temporalmente `SOURCE_DATABASE_URL` con acceso de lectura al origen (y `DATABASE_URL` apuntando a Core).
3. Ejecutar `npm run migration:legacy-qc:dry-run`.
4. Revisar conteos (`sourceBatches` = cantidad de compras) y ejecutar `npm run migration:legacy-qc:apply`.
5. Verificar tablas, resultados, revisores, lotes y auditoría.

El migrador es idempotente (clave `source_system + source_record_id`): si se reejecuta, actualiza
los lotes por compra y reasocia los equipos sin duplicar.

El importador procesa bloques de 500 dentro de transacciones cortas. Si un bloque falla, puede corregirse la causa y repetir el comando sin duplicar registros.

## Reglas de mapeo

| SDigitalSystem | SDigitalCore |
|---|---|
| `supplier` | `qc_supplier` |
| `equipo` | `device_unit` |
| último `equipo_historial.estado = 'Revisado'` | `qc_inspection` completada |
| `Funcional` | `FUNCTIONAL` |
| `No funcional` / `No Funcional` | `NON_FUNCTIONAL` |
| funcionalidad vacía | `UNSPECIFIED` |
| equipo funcional activo | `AVAILABLE` |
| equipo no funcional activo | `QUARANTINED` |
| equipo ya entregado | `ARCHIVED` |

## Verificación

```sql
SELECT COUNT(*) FROM qc_supplier WHERE source_system = 'SDIGITALSYSTEM';

SELECT batch_number, supplier_name, total_devices, reviewed_devices
FROM qc_revision_batch
WHERE batch_number LIKE 'LOT-LEGACY-SDS-%'
ORDER BY received_at;

SELECT result, COUNT(*)
FROM qc_inspection
WHERE source_system = 'SDIGITALSYSTEM'
GROUP BY result;

SELECT COUNT(*)
FROM qc_inspection
WHERE source_system = 'SDIGITALSYSTEM' AND reviewer_name_snapshot = '';

SELECT COUNT(*)
FROM device_unit d
LEFT JOIN qc_inspection q ON q.device_id = d.id
WHERE d.source_system = 'SDIGITALSYSTEM' AND q.id IS NULL;
```

## Reversión

No ejecutar una reversión automática después de que Core empiece a crear operaciones relacionadas. Antes de uso operativo, los registros importados pueden identificarse de forma exacta por `source_system = 'SDIGITALSYSTEM'`; cualquier eliminación requiere confirmación explícita y revisión de relaciones.
