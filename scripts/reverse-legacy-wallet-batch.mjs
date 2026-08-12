import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const batchId = process.argv.find((argument) => argument.startsWith("--batch="))?.slice("--batch=".length);
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) throw new Error("Falta la variable de entorno DATABASE_URL.");
if (!batchId) throw new Error("Indica el lote con --batch=<id>.");
if (process.env.CONFIRM_LEGACY_WALLET_REVERSAL !== "YES") {
  throw new Error("La reversión requiere CONFIRM_LEGACY_WALLET_REVERSAL=YES.");
}

const client = new Client({ connectionString: databaseUrl, application_name: "sdigitalcore-legacy-reversal" });
await client.connect();

try {
  await client.query("BEGIN");
  const batch = (await client.query(`
    SELECT id, status, mode FROM legacy_migration_batch WHERE id = $1 FOR UPDATE
  `, [batchId])).rows[0];
  if (!batch) throw new Error("No existe ese lote de migración.");
  if (batch.status === "REVERSED") throw new Error("Ese lote ya fue revertido.");
  if (batch.mode !== "CUTOVER" || batch.status !== "COMPLETED") {
    throw new Error("Solo se puede revertir un corte completado.");
  }

  const entries = (await client.query(`
    SELECT e.id, e.wallet_id AS "walletId", e.amount::text, e.external_key AS "externalKey"
    FROM wallet_ledger_entry e
    WHERE e.batch_id = $1 AND e.type = 'LEGACY_OPENING_BALANCE' AND e.status = 'POSTED'
    ORDER BY e.id
    FOR UPDATE
  `, [batchId])).rows;

  for (const entry of entries) {
    const reversalKey = `${entry.externalKey}:reversal`;
    const inserted = await client.query(`
      INSERT INTO wallet_ledger_entry (
        id, wallet_id, type, amount, description, external_key, batch_id, reversal_of_id, occurred_at
      ) VALUES ($1, $2, 'REVERSAL', -($3::numeric), $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (external_key) DO NOTHING
      RETURNING id
    `, [crypto.randomUUID(), entry.walletId, entry.amount, "Reversión auditada de saldo inicial legacy", reversalKey, batchId, entry.id]);
    if (inserted.rowCount === 1) {
      await client.query("UPDATE wallet SET balance = balance - ($1::numeric), updated_at = CURRENT_TIMESTAMP WHERE id = $2", [entry.amount, entry.walletId]);
    }
  }

  await client.query(`
    UPDATE legacy_user_identity
    SET match_status = 'LINKED_PENDING_CUTOVER', transferred_at = NULL
    WHERE batch_id = $1 AND match_status = 'TRANSFERRED'
  `, [batchId]);
  await client.query("UPDATE legacy_migration_batch SET status = 'REVERSED' WHERE id = $1", [batchId]);
  await client.query("COMMIT");
  console.log(JSON.stringify({ success: true, batchId, reversedEntries: entries.length }, null, 2));
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
