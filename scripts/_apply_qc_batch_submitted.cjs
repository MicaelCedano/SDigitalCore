// Aplicar migración del enum qc_batch_status (agregar SUBMITTED)
const { Client } = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ...(connectionString.includes(".pooler.supabase.com") ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  await client.connect();

  const sql = `
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'qc_batch_status'::regtype
          AND enumlabel = 'SUBMITTED'
    ) THEN
        ALTER TYPE "qc_batch_status" ADD VALUE 'SUBMITTED';
    END IF;
END $$;
`;
  await client.query(sql);
  console.log("✅ enum qc_batch_status: SUBMITTED agregado (si no existía)");

  // Verificar
  const check = await client.query(
    `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'qc_batch_status'::regtype ORDER BY enumsortorder`
  );
  console.log("Estados actuales:", check.rows.map((r) => r.enumlabel).join(", "));

  await client.end();
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
