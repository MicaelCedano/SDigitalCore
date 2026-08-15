import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);

export async function inspectMigrationLayout(projectRoot) {
  const migrationsDir = path.join(projectRoot, "prisma", "migrations");
  const manifestPath = path.join(projectRoot, "prisma", "manual-migrations.json");
  const [entries, manifestText] = await Promise.all([
    fs.readdir(migrationsDir, { withFileTypes: true }),
    fs.readFile(manifestPath, "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const bareSqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
  const invalidDirectories = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    try {
      await fs.access(path.join(migrationsDir, entry.name, "migration.sql"));
    } catch {
      invalidDirectories.push(entry.name);
    }
  }
  const manifestFiles = [...(manifest.files ?? [])].sort();
  const unregisteredBareSql = bareSqlFiles.filter((file) => !manifestFiles.includes(file));
  const staleManifestEntries = manifestFiles.filter((file) => !bareSqlFiles.includes(file));
  return {
    bareSqlFiles,
    invalidDirectories: invalidDirectories.sort(),
    unregisteredBareSql,
    staleManifestEntries,
    manualMigrationStatus: manifest.status,
  };
}

export function formatMigrationLayoutErrors(report) {
  const errors = [];
  if (report.invalidDirectories.length > 0) {
    errors.push(`Directorios sin migration.sql: ${report.invalidDirectories.join(", ")}`);
  }
  if (report.unregisteredBareSql.length > 0) {
    errors.push(`SQL sueltos sin registrar en prisma/manual-migrations.json: ${report.unregisteredBareSql.join(", ")}`);
  }
  if (report.staleManifestEntries.length > 0) {
    errors.push(`Entradas del manifiesto que ya no existen como SQL suelto: ${report.staleManifestEntries.join(", ")}`);
  }
  if (report.manualMigrationStatus !== "requires-production-reconciliation") {
    errors.push("El manifiesto debe conservar status=requires-production-reconciliation hasta verificar producción.");
  }
  return errors;
}

export async function main() {
  const projectRoot = path.resolve(path.dirname(scriptPath), "..");
  const report = await inspectMigrationLayout(projectRoot);
  const errors = formatMigrationLayoutErrors(report);
  if (errors.length > 0) {
    console.error(errors.map((error) => `ERROR: ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(`SQL manuales registrados: ${report.bareSqlFiles.length}.`);
  console.log("La reconciliación de producción sigue pendiente y no se ejecuta automáticamente.");
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  await main();
}
