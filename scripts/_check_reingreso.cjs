// Estado actual de los IMEIs bloqueados + su historial
const { Pool } = require("pg");

async function main() {
  const core = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const imeis = [
    "350197047516372","352843115083724","352846110462728","352857114694398","353889103745377",
    "353894109049469","353897103991883","353899101181483","353901108537145","357183967650683",
    "357414191626896","358790732338557"
  ];
  const rows = (await core.query(`
    SELECT id, imei, brand, model, status, batch_id, source_system, source_record_id, created_at, updated_at
    FROM device_unit WHERE imei = ANY($1::text[]) ORDER BY imei
  `, [imeis])).rows;
  console.log("=== device_unit de los 12 IMEIs ===");
  rows.forEach((r) => console.log(JSON.stringify(r)));

  // ¿Tienen inspecciones previas?
  const insp = await core.query(`
    SELECT d.imei, i.status, i.result, i.grade, i.reviewed_at, i.created_at
    FROM qc_inspection i JOIN device_unit d ON d.id = i.device_id
    WHERE d.imei = ANY($1::text[]) ORDER BY d.imei, i.created_at
  `, [imeis]);
  console.log("\n=== Inspecciones previas ===");
  insp.rows.forEach((r) => console.log(JSON.stringify(r)));

  // ¿Están en repair_job_item (reparados)?
  const rep = await core.query(`
    SELECT imei, problema, job_id FROM repair_job_item WHERE imei = ANY($1::text[])
  `, [imeis]);
  console.log("\n=== En repair_job_item ===");
  rep.rows.forEach((r) => console.log(JSON.stringify(r)));

  // ¿Están en warranty_case?
  const war = await core.query(`
    SELECT imei, case_code, status FROM warranty_case WHERE imei = ANY($1::text[])
  `, [imeis]);
  console.log("\n=== En warranty_case ===");
  war.rows.forEach((r) => console.log(JSON.stringify(r)));
  await core.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
