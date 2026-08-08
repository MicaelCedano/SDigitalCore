# Importacion de productos de Almacen Casita - 2026-08-08

## Alcance

Esta importacion lleva a `warehouse_product` solamente el catalogo de productos y su existencia actual. No importa movimientos, solicitudes, perfiles, usuarios ni credenciales del sistema independiente.

Fuente original: `backup_almacen_casita_2026-08-08.json`, exportado el `2026-08-08T03:31:25.091Z`.

Resumen validado:

- 127 productos.
- 59 productos con existencias mayores que cero.
- 68 productos con existencia cero.
- 1,723 cajas.
- 16,832 unidades.
- 0 codigos duplicados.
- 0 inconsistencias entre `cajas * unidades_por_caja` y `cantidad`.

## Archivos

- Snapshot sanitizado: `data/imports/almacen-casita-products-2026-08-08.json`.
- Migracion para revision manual: `prisma/migrations/20260808130000_import_almacen_casita_products/migration.sql`.
- Generador y validador reproducible: `scripts/prepare-almacen-casita-products-import.mjs`.

El snapshot sanitizado no contiene hashes de contrasena ni datos de usuarios.

## Mapeo

| Backup Almacen Casita | SDigitalCore |
| --- | --- |
| `codigo` | `warehouse_product.codigo` |
| `nombre` | `warehouse_product.nombre` |
| `marca` | `warehouse_product.marca` |
| `color` | `warehouse_product.color` |
| `capacidad` | `warehouse_product.capacidad` |
| `descripcion` | `warehouse_product.descripcion` |
| `cajas` | `warehouse_product.cajas` |
| `unidades_por_caja` | `warehouse_product.unidades_por_caja` |
| `cantidad` | `warehouse_product.cantidad` |

La migracion usa `codigo` como identidad de negocio. Si el codigo ya existe, actualiza el producto y su existencia; si no existe, lo crea.

## Aplicacion manual

1. Generar un respaldo previo de `warehouse_product` en Supabase.
2. Revisar el SQL de la migracion.
3. Aplicarlo manualmente en el proyecto Supabase correcto.
4. Confirmar que la consulta final devuelve exactamente 127 productos del snapshot, 1,723 cajas y 16,832 unidades.
5. Abrir `/almacen` y revisar una muestra de productos con y sin existencia.

No ejecutar `prisma migrate deploy` ni `prisma db push` contra produccion para esta carga.

## Riesgo y reversa

La importacion es idempotente, pero actualiza por codigo cantidades existentes. El riesgo principal es sobrescribir cambios hechos despues de la fecha del respaldo.

Para revertir, restaurar el respaldo previo de `warehouse_product`. No se debe intentar una reversa mediante borrado general porque algunos codigos pueden haber existido antes de esta importacion.

## Regeneracion

```powershell
npm.cmd run import:prepare:almacen-products -- "C:\ruta\al\backup_almacen_casita_2026-08-08.json"
```

El generador falla antes de escribir la carga si encuentra codigos o IDs duplicados, cantidades invalidas, fechas invalidas o discrepancias de inventario.

