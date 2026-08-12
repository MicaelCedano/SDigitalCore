# Migración de equipos revisados y proveedores QC

## Alcance

- Lee proveedores, equipos e historial de revisiones desde SDigitalSystem sin escribir en su base de datos.
- Importa proveedores QC con identidad externa estable.
- Importa un `DeviceUnit` y la última inspección válida por cada equipo con historial `Revisado`.
- Conserva IMEI, marca, modelo, almacenamiento, color, grado, observación, resultado y fecha.
- Recupera el último revisor identificado cuando el evento final no tiene `user_id`.
- Enlaza `reviewer_id` solo cuando la identidad legacy fue confirmada en Core; siempre conserva `reviewer_name_snapshot`.
- Omite registros cuya funcionalidad histórica no sea `Funcional` o `No funcional` en vez de inventar un resultado.
- Usa `source_system + source_record_id` para permitir reejecuciones idempotentes.

## Orden operativo

1. Aplicar `20260811210000_add_qc_suppliers`.
2. Aplicar `20260812170000_add_legacy_qc_traceability`.
3. Configurar temporalmente `SOURCE_DATABASE_URL` con acceso de lectura al origen.
4. Ejecutar `npm run migration:legacy-qc:dry-run`.
5. Revisar conteos y ejecutar `npm run migration:legacy-qc:apply`.
6. Verificar tablas, resultados, revisores y auditoría.

El importador procesa bloques de 500 dentro de transacciones cortas. Si un bloque falla, puede corregirse la causa y repetir el comando sin duplicar registros.

## Reglas de mapeo

| SDigitalSystem | SDigitalCore |
|---|---|
| `supplier` | `qc_supplier` |
| `equipo` | `device_unit` |
| último `equipo_historial.estado = 'Revisado'` | `qc_inspection` completada |
| `Funcional` | `FUNCTIONAL` |
| `No funcional` / `No Funcional` | `NON_FUNCTIONAL` |
| equipo funcional activo | `AVAILABLE` |
| equipo no funcional activo | `QUARANTINED` |
| equipo ya entregado | `ARCHIVED` |

## Verificación

```sql
SELECT COUNT(*) FROM qc_supplier WHERE source_system = 'SDIGITALSYSTEM';

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
