// Migra el historial de penalidades de SDigitalSystem (tabla `penalidad`)
// a Core (tabla `penalty`) como registros HISTÓRICOS:
// - source_system='SDIGITALSYSTEM', status ACTIVE, ledger_entry_id NULL
//   (su descuento ya está incluido en el saldo del wallet migrado: NO se
//   vuelve a descontar ni se puede revertir desde Core).
// - Idempotente vía id `legacy-sds-penalty-{id}` (ON CONFLICT DO NOTHING).
// - Solo migra penalidades de técnicos YA ENLAZADOS (legacy_user_identity con
//   core_user_id); las de técnicos sin usuario Core se reportan como pendientes
//   (re-correr el script cuando se registren/enlacen).
// Uso: node --env-file=.env.local scripts/migrate-legacy-penalties.mjs [--apply]
import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const APPLY = process.argv.includes("--apply");
const SOURCE_SYSTEM = "SDIGITALSYSTEM";
const ADMIN_FALLBACK = "dev-admin-001";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}

async function main() {
  const source = new Client({ connectionString: requiredEnv("SOURCE_DATABASE_URL"), ssl: { rejectUnauthorized: false }, application_name: "sdigitalcore-legacy-penalties-reader" });
  const target = new Client({ connectionString: requiredEnv("DATABASE_URL"), ssl: { rejectUnauthorized: false }, application_name: "sdigitalcore-legacy-penalties-migrator" });
  await Promise.all([source.connect(), target.connect()]);

  try {
    // 1. Leer penalidades de System + usuarios
    const [penalties, users] = await Promise.all([
      source.query(`
        SELECT p.id, p.tecnico_id::text AS "tecnicoId", p.equipo_id::text AS "equipoId",
               p.motivo, p.monto::text AS monto, p.fecha, p.admin_id::text AS "adminId"
        FROM penalidad p
        ORDER BY p.id
      `),
      source.query(`SELECT id::text AS id, username FROM users`),
    ]);
    if (!penalties.rows.length) {
      console.log(JSON.stringify({ success: true, mode: APPLY ? "APPLY" : "DRY_RUN", migrated: 0, message: "No hay penalidades en System." }, null, 2));
      return;
    }
    const userNames = new Map(users.rows.map((u) => [u.id, u.username]));

    // 2. Mapeos en Core
    const techIds = [...new Set(penalties.rows.map((p) => p.tecnicoId))];
    const equipoIds = [...new Set(penalties.rows.map((p) => p.equipoId).filter(Boolean))];

    const [identities, devices, admins] = await Promise.all([
      target.query(
        `SELECT source_user_id, core_user_id FROM legacy_user_identity WHERE source_user_id = ANY($1) AND core_user_id IS NOT NULL`,
        [techIds],
      ),
      target.query(
        `SELECT id, source_record_id, imei, model FROM device_unit WHERE source_system = $1 AND source_record_id = ANY($2)`,
        [SOURCE_SYSTEM, equipoIds],
      ),
      target.query(`SELECT id FROM "user" WHERE id = $1`, [ADMIN_FALLBACK]),
    ]);

    const techBySource = new Map(identities.rows.map((r) => [r.source_user_id, r.core_user_id]));
    const deviceByEquipo = new Map(devices.rows.map((r) => [r.source_record_id, r]));
    const adminFallback = admins.rows[0]?.id ?? null;

    // 3. Armar filas
    const rows = [];
    const skipped = [];
    for (const p of penalties.rows) {
      const coreTech = techBySource.get(p.tecnicoId);
      if (!coreTech) {
        skipped.push({ sourceId: p.id, username: userNames.get(p.tecnicoId) ?? p.tecnicoId, monto: p.monto });
        continue;
      }
      // Admin: resolver por identidad legacy si existe, si no fallback dev-admin-001
      const adminRow = (await target.query(
        `SELECT core_user_id FROM legacy_user_identity WHERE source_user_id = $1 AND core_user_id IS NOT NULL LIMIT 1`,
        [p.adminId],
      )).rows[0];
      const adminId = adminRow?.core_user_id ?? adminFallback;
      if (!adminId) throw new Error("No existe dev-admin-001 como fallback de admin.");

      const device = deviceByEquipo.get(p.equipoId);
      rows.push({
        id: `legacy-sds-penalty-${p.id}`,
        tecnicoId: coreTech,
        equipoId: p.equipoId,
        deviceId: device?.id ?? null,
        imei: device?.imei ?? null,
        model: device?.model ?? null,
        motivo: p.motivo?.trim() || "Penalidad histórica",
        monto: Number(p.monto),
        adminId,
        fecha: p.fecha ? new Date(p.fecha) : new Date(),
      });
    }

    const totalMonto = rows.reduce((sum, r) => sum + r.monto, 0);

    console.log(
      JSON.stringify(
        {
          success: true,
          mode: APPLY ? "APPLY" : "DRY_RUN",
          sourceTotal: penalties.rows.length,
          migrables: rows.length,
          montoMigrable: Number(totalMonto.toFixed(2)),
          pendientesPorEnlazar: skipped.length,
          pendientes: skipped.map((s) => ({ username: s.username, count: skipped.filter((x) => x.username === s.username).length, monto: Number(skipped.filter((x) => x.username === s.username).reduce((a, x) => a + Number(x.monto), 0).toFixed(2)) })).filter((v, i, arr) => arr.findIndex((x) => x.username === v.username) === i),
          devicesSinMatch: rows.filter((r) => !r.deviceId).length,
        },
        null,
        2,
      ),
    );

    if (!APPLY) return;

    // 4. Insertar (idempotente)
    await target.query("BEGIN");
    try {
      for (const r of rows) {
        await target.query(
          `INSERT INTO penalty (
             id, type, device_imei, device_model, device_id, technician_id,
             motivo, monto, status, admin_id, ledger_entry_id, source_system, created_at
           ) VALUES ($1, 'INTERNAL', $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, NULL, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [r.id, r.imei, r.model, r.deviceId, r.tecnicoId, r.motivo, r.monto, r.adminId, SOURCE_SYSTEM, r.fecha],
        );
      }
      await target.query("COMMIT");
    } catch (error) {
      await target.query("ROLLBACK").catch(() => undefined);
      throw error;
    }

    // 5. Verificación read-only
    const verify = new Client({ connectionString: requiredEnv("DATABASE_URL"), ssl: { rejectUnauthorized: false }, application_name: "sdigitalcore-legacy-penalties-verify" });
    await verify.connect();
    const migrated = await verify.query(
      `SELECT count(*)::int AS total, round(sum(monto)::numeric, 2)::text AS monto_total FROM penalty WHERE source_system = $1`,
      [SOURCE_SYSTEM],
    );
    console.log(JSON.stringify({ verificado: migrated.rows[0] }, null, 2));
    await verify.end();
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
