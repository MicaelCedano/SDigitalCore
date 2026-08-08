# Equipos sin caja en Almacén — 2026-08-08

Se añade `warehouse_product.unidades_sueltas` para registrar equipos individuales recibidos sin caja.

El total se calcula como:

```text
(cajas × unidades_por_caja) + unidades_sueltas
```

Los productos importados conservan sus cantidades actuales porque `unidades_sueltas` inicia en `0`.

## Verificación

```sql
SELECT COUNT(*) AS productos,
       COALESCE(SUM(cajas), 0) AS cajas,
       COALESCE(SUM(unidades_sueltas), 0) AS sin_caja,
       COALESCE(SUM(cantidad), 0) AS unidades
FROM warehouse_product;
```
