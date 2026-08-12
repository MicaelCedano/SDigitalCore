// Verifica jobs pendientes de pago en Core + permisos del admin
const { Pool } = require("pg");

async function main() {
  const core = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const pending = await core.query(`
    SELECT j.id, j.job_code, j.status, j.total_equipos, j.monto_total, j.created_at, j.technician_id,
           u.name AS tecnico, u.username AS username
    FROM repair_job j JOIN "user" u ON u.id = j.technician_id
    WHERE j.status = 'PENDING_PAYMENT' ORDER BY j.created_at
  `);
  console.log("=== Jobs PENDING_PAYMENT ===");
  pending.rows.forEach((r) => console.log(JSON.stringify(r)));

  const items = await core.query(`
    SELECT i.job_id, i.imei, i.cliente, i.problema FROM repair_job_item i
    JOIN repair_job j ON j.id = i.job_id WHERE j.status = 'PENDING_PAYMENT' ORDER BY i.created_at
  `);
  console.log("\n=== Items de jobs pendientes ===");
  items.rows.forEach((r) => console.log(JSON.stringify(r)));

  const admin = await core.query(`
    SELECT id, name, username, role_code, allowed_modules FROM "user" WHERE username = 'dev-admin-001' OR role_code = 'ADMIN' LIMIT 3
  `);
  console.log("\n=== Admins ===");
  admin.rows.forEach((r) => console.log(JSON.stringify(r)));
  await core.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
