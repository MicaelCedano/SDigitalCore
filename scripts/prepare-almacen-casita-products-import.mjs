import fs from "node:fs";
import path from "node:path";

const [backupPathArg] = process.argv.slice(2);

if (!backupPathArg) {
  console.error("Uso: node scripts/prepare-almacen-casita-products-import.mjs <backup.json>");
  process.exit(1);
}

const backupPath = path.resolve(backupPathArg);
const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const products = backup?.data?.products;

if (!Array.isArray(products)) {
  throw new Error("El respaldo no contiene data.products.");
}

const requiredFields = [
  "id",
  "codigo",
  "nombre",
  "cajas",
  "unidades_por_caja",
  "cantidad",
  "fecha_creacion",
  "fecha_actualizacion",
];

const seenIds = new Set();
const seenCodes = new Set();

for (const [index, product] of products.entries()) {
  for (const field of requiredFields) {
    if (product[field] === undefined || product[field] === null || product[field] === "") {
      throw new Error(`Producto ${index + 1}: falta el campo ${field}.`);
    }
  }

  const code = String(product.codigo).trim();
  const normalizedCode = code.toUpperCase();
  const boxes = Number(product.cajas);
  const unitsPerBox = Number(product.unidades_por_caja);
  const totalUnits = Number(product.cantidad);

  if (seenIds.has(product.id)) throw new Error(`ID duplicado: ${product.id}`);
  if (seenCodes.has(normalizedCode)) throw new Error(`Codigo duplicado: ${code}`);
  if (![boxes, unitsPerBox, totalUnits].every(Number.isInteger)) {
    throw new Error(`Producto ${code}: las cantidades deben ser enteros.`);
  }
  if (boxes < 0 || unitsPerBox < 1 || totalUnits < 0) {
    throw new Error(`Producto ${code}: cantidades fuera de rango.`);
  }
  if (boxes * unitsPerBox !== totalUnits) {
    throw new Error(
      `Producto ${code}: cantidad ${totalUnits} no coincide con ${boxes} x ${unitsPerBox}.`,
    );
  }
  if (Number.isNaN(Date.parse(product.fecha_creacion)) || Number.isNaN(Date.parse(product.fecha_actualizacion))) {
    throw new Error(`Producto ${code}: fecha invalida.`);
  }

  seenIds.add(product.id);
  seenCodes.add(normalizedCode);
}

const snapshot = {
  source: path.basename(backupPath),
  exportedAt: backup.exportedAt,
  productsCount: products.length,
  totalBoxes: products.reduce((sum, product) => sum + Number(product.cajas), 0),
  totalUnits: products.reduce((sum, product) => sum + Number(product.cantidad), 0),
  products: products.map((product) => ({
    id: String(product.id),
    codigo: String(product.codigo).trim(),
    nombre: String(product.nombre).trim(),
    marca: product.marca ? String(product.marca).trim() : null,
    color: product.color ? String(product.color).trim() : null,
    capacidad: product.capacidad ? String(product.capacidad).trim() : null,
    descripcion: product.descripcion ? String(product.descripcion).trim() : null,
    cajas: Number(product.cajas),
    unidades_por_caja: Number(product.unidades_por_caja),
    cantidad: Number(product.cantidad),
    fecha_creacion: product.fecha_creacion,
    fecha_actualizacion: product.fecha_actualizacion,
  })),
};

const sqlString = (value) => {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
};

const rows = snapshot.products
  .map(
    (product) =>
      `  (${[
        sqlString(product.id),
        sqlString(product.codigo),
        sqlString(product.nombre),
        sqlString(product.marca),
        sqlString(product.color),
        sqlString(product.capacidad),
        sqlString(product.descripcion),
        product.cajas,
        product.unidades_por_caja,
        product.cantidad,
        `${sqlString(product.fecha_creacion)}::timestamptz`,
        `${sqlString(product.fecha_actualizacion)}::timestamptz`,
      ].join(", ")})`,
  )
  .join(",\n");

const migration = `-- Importacion idempotente del catalogo y stock actual de Almacen Casita.
-- Fuente: ${snapshot.source}
-- Exportado: ${snapshot.exportedAt}
-- Incluye solamente productos y cantidades; excluye usuarios, solicitudes y movimientos.
-- Aplicar manualmente en Supabase despues de revisar el SQL.

BEGIN;

INSERT INTO "warehouse_product" (
  "id",
  "codigo",
  "nombre",
  "marca",
  "color",
  "capacidad",
  "descripcion",
  "cajas",
  "unidades_por_caja",
  "cantidad",
  "created_at",
  "updated_at"
)
VALUES
${rows}
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "marca" = EXCLUDED."marca",
  "color" = EXCLUDED."color",
  "capacidad" = EXCLUDED."capacidad",
  "descripcion" = EXCLUDED."descripcion",
  "cajas" = EXCLUDED."cajas",
  "unidades_por_caja" = EXCLUDED."unidades_por_caja",
  "cantidad" = EXCLUDED."cantidad",
  "updated_at" = EXCLUDED."updated_at";

INSERT INTO "audit_log" (
  "id",
  "user_id",
  "action",
  "module",
  "entity_type",
  "entity_id",
  "after_data",
  "created_at"
)
VALUES (
  'import-almacen-casita-products-20260808',
  NULL,
  'warehouse_product.snapshot.import',
  'almacen',
  'warehouse_product',
  'backup_2026-08-08',
  '{"products":${snapshot.productsCount},"boxes":${snapshot.totalBoxes},"units":${snapshot.totalUnits},"source":"${snapshot.source}"}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "after_data" = EXCLUDED."after_data",
  "created_at" = EXCLUDED."created_at";

COMMIT;

-- Verificacion esperada del snapshot importado:
-- products = ${snapshot.productsCount}, boxes = ${snapshot.totalBoxes}, units = ${snapshot.totalUnits}
SELECT
  COUNT(*) FILTER (WHERE "codigo" IN (${snapshot.products.map((product) => sqlString(product.codigo)).join(", ")})) AS imported_products,
  COALESCE(SUM("cajas") FILTER (WHERE "codigo" IN (${snapshot.products.map((product) => sqlString(product.codigo)).join(", ")})), 0) AS imported_boxes,
  COALESCE(SUM("cantidad") FILTER (WHERE "codigo" IN (${snapshot.products.map((product) => sqlString(product.codigo)).join(", ")})), 0) AS imported_units
FROM "warehouse_product";
`;

const snapshotDir = path.resolve("data", "imports");
const migrationDir = path.resolve("prisma", "migrations", "20260808130000_import_almacen_casita_products");
fs.mkdirSync(snapshotDir, { recursive: true });
fs.mkdirSync(migrationDir, { recursive: true });
fs.writeFileSync(
  path.join(snapshotDir, "almacen-casita-products-2026-08-08.json"),
  `${JSON.stringify(snapshot, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(path.join(migrationDir, "migration.sql"), migration, "utf8");

console.log(
  JSON.stringify(
    {
      products: snapshot.productsCount,
      nonZeroProducts: snapshot.products.filter((product) => product.cantidad > 0).length,
      zeroProducts: snapshot.products.filter((product) => product.cantidad === 0).length,
      boxes: snapshot.totalBoxes,
      units: snapshot.totalUnits,
      snapshot: path.relative(process.cwd(), path.join(snapshotDir, "almacen-casita-products-2026-08-08.json")),
      migration: path.relative(process.cwd(), path.join(migrationDir, "migration.sql")),
    },
    null,
    2,
  ),
);

