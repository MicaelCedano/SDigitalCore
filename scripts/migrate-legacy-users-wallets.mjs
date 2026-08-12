import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const SOURCE_SYSTEM = "SDIGITALSYSTEM";
const mode = process.argv.includes("--cutover")
  ? "CUTOVER"
  : process.argv.includes("--apply")
    ? "APPLY"
    : "DRY_RUN";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}

function normalize(value) {
  return value?.trim().toLocaleLowerCase("es") || null;
}

function money(value) {
  return Number(Number(value ?? 0).toFixed(2));
}

function checksumOf(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readSource(source) {
  const duplicateWallets = (await source.query(`
    SELECT tecnico_id::text AS "sourceUserId", COUNT(*)::int AS count
    FROM wallet
    GROUP BY tecnico_id
    HAVING COUNT(*) > 1
  `)).rows;
  if (duplicateWallets.length) {
    throw new Error(`Hay usuarios con más de una wallet: ${duplicateWallets.map((row) => row.sourceUserId).join(", ")}.`);
  }
  const walletMismatches = (await source.query(`
    SELECT w.tecnico_id::text AS "sourceUserId"
    FROM wallet w
    LEFT JOIN wallet_account a ON a.wallet_id = w.id
    GROUP BY w.id, w.tecnico_id, w.saldo
    HAVING ROUND(COALESCE(w.saldo, 0)::numeric, 2) <> ROUND(COALESCE(SUM(a.saldo), 0)::numeric, 2)
  `)).rows;
  if (walletMismatches.length) {
    throw new Error(`Hay wallets que no cuadran con sus subcuentas: ${walletMismatches.map((row) => row.sourceUserId).join(", ")}.`);
  }
  const users = (await source.query(`
    SELECT
      u.id::text AS "sourceUserId",
      u.username,
      u.name,
      u.email,
      u.role,
      u.is_active AS "isActive",
      COALESCE(w.saldo, 0)::numeric(14,2)::text AS "walletBalance",
      COUNT(t.id)::int AS "transactionCount"
    FROM users u
    LEFT JOIN wallet w ON w.tecnico_id = u.id
    LEFT JOIN wallet_transaction t ON t.tecnico_id = u.id
    GROUP BY u.id, u.username, u.name, u.email, u.role, u.is_active, w.saldo
    ORDER BY u.id
  `)).rows;

  const transactions = (await source.query(`
    SELECT
      t.id::text AS "sourceTransactionId",
      t.tecnico_id::text AS "sourceUserId",
      t.monto::numeric(14,2)::text AS amount,
      t.tipo,
      t.estado,
      t.descripcion,
      t.fecha AS "occurredAt",
      t.canjeado AS redeemed
    FROM wallet_transaction t
    ORDER BY t.id
  `)).rows;

  const accounts = (await source.query(`
    SELECT
      a.id::text AS "sourceAccountId",
      w.tecnico_id::text AS "sourceUserId",
      a.nombre AS name,
      a.tipo AS type,
      a.saldo::numeric(14,2)::text AS balance,
      a.meta_ahorro::numeric(14,2)::text AS "savingsGoal",
      a.color,
      a.fecha_creacion AS "sourceCreatedAt"
    FROM wallet_account a
    INNER JOIN wallet w ON w.id = a.wallet_id
    ORDER BY a.id
  `)).rows;

  const walletCount = Number((await source.query("SELECT COUNT(*)::int AS count FROM wallet")).rows[0].count);
  const accountTotal = money((await source.query(`
    SELECT COALESCE(SUM(a.saldo), 0)::numeric(14,2)::text AS total
    FROM wallet_account a
  `)).rows[0].total);
  const walletTotal = money(users.reduce((sum, user) => sum + money(user.walletBalance), 0));

  return { users, transactions, accounts, walletCount, accountTotal, walletTotal };
}

async function readCoreUsers(target) {
  return (await target.query(`
    SELECT id, username, name, email, role_code AS "roleCode", allowed_modules AS "allowedModules", status
    FROM "user"
    ORDER BY created_at
  `)).rows;
}

function buildMatches(sourceUsers, coreUsers) {
  return sourceUsers.map((legacy) => {
    const email = normalize(legacy.email);
    const username = normalize(legacy.username);
    const emailMatches = email ? coreUsers.filter((user) => normalize(user.email) === email) : [];
    const usernameMatches = username ? coreUsers.filter((user) => normalize(user.username) === username) : [];
    const distinct = new Map([...emailMatches, ...usernameMatches].map((user) => [user.id, user]));
    let status = "UNMATCHED";
    let method = null;
    let candidate = null;

    if (distinct.size > 1) {
      status = "CONFLICT";
      method = "email_username_conflict";
    } else if (emailMatches.length === 1) {
      status = "SUGGESTED";
      method = "exact_email";
      candidate = emailMatches[0];
    } else if (usernameMatches.length === 1) {
      status = "SUGGESTED";
      method = "exact_username";
      candidate = usernameMatches[0];
    }

    return { legacy, status, method, candidate };
  });
}

async function insertBatch(target, snapshot, selectedMode) {
  const id = crypto.randomUUID();
  const reconciliation = {
    walletHeaderTotal: snapshot.walletTotal,
    accountTotal: snapshot.accountTotal,
    balanced: snapshot.walletTotal === snapshot.accountTotal,
  };
  await target.query(`
    INSERT INTO legacy_migration_batch (
      id, source_system, mode, source_user_count, source_wallet_count,
      source_account_count, source_transaction_count, source_balance_total, checksum, reconciliation
    ) VALUES ($1, $2, $3::legacy_migration_mode, $4, $5, $6, $7, $8, $9, $10::jsonb)
  `, [
    id,
    SOURCE_SYSTEM,
    selectedMode,
    snapshot.users.length,
    snapshot.walletCount,
    snapshot.accounts.length,
    snapshot.transactions.length,
    snapshot.walletTotal,
    checksumOf({ users: snapshot.users, accounts: snapshot.accounts, transactions: snapshot.transactions }),
    JSON.stringify(reconciliation),
  ]);
  return id;
}

async function syncSnapshot(target, batchId, matches, transactions, accounts) {
  const identityIds = new Map();
  for (const match of matches) {
    const legacy = match.legacy;
    const result = await target.query(`
      INSERT INTO legacy_user_identity (
        id, source_system, source_user_id, username_snapshot, name_snapshot,
        email_snapshot, role_snapshot, active_snapshot, source_wallet_balance,
        source_transaction_count, match_status, match_method, batch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::legacy_identity_match_status, $12, $13)
      ON CONFLICT (source_system, source_user_id) DO UPDATE SET
        username_snapshot = EXCLUDED.username_snapshot,
        name_snapshot = EXCLUDED.name_snapshot,
        email_snapshot = EXCLUDED.email_snapshot,
        role_snapshot = EXCLUDED.role_snapshot,
        active_snapshot = EXCLUDED.active_snapshot,
        source_wallet_balance = EXCLUDED.source_wallet_balance,
        source_transaction_count = EXCLUDED.source_transaction_count,
        match_status = CASE
          WHEN legacy_user_identity.match_status IN ('LINKED_PENDING_CUTOVER', 'TRANSFERRED', 'EXCLUDED')
            THEN legacy_user_identity.match_status
          ELSE EXCLUDED.match_status
        END,
        match_method = CASE
          WHEN legacy_user_identity.match_status IN ('LINKED_PENDING_CUTOVER', 'TRANSFERRED', 'EXCLUDED')
            THEN legacy_user_identity.match_method
          ELSE EXCLUDED.match_method
        END,
        batch_id = EXCLUDED.batch_id,
        last_synced_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [
      crypto.randomUUID(), SOURCE_SYSTEM, legacy.sourceUserId, legacy.username, legacy.name,
      legacy.email, legacy.role, legacy.isActive, money(legacy.walletBalance),
      legacy.transactionCount, match.status, match.method, batchId,
    ]);
    identityIds.set(legacy.sourceUserId, result.rows[0].id);
  }

  for (const account of accounts) {
    const identityId = identityIds.get(account.sourceUserId);
    if (!identityId) throw new Error(`No existe identidad para la cuenta ${account.sourceAccountId}.`);
    await target.query(`
      INSERT INTO legacy_wallet_account (
        id, source_system, source_account_id, legacy_identity_id, name_snapshot,
        type_snapshot, balance_snapshot, savings_goal_snapshot, color_snapshot,
        created_at_snapshot, batch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (source_system, source_account_id) DO UPDATE SET
        legacy_identity_id = EXCLUDED.legacy_identity_id,
        name_snapshot = EXCLUDED.name_snapshot,
        type_snapshot = EXCLUDED.type_snapshot,
        balance_snapshot = EXCLUDED.balance_snapshot,
        savings_goal_snapshot = EXCLUDED.savings_goal_snapshot,
        color_snapshot = EXCLUDED.color_snapshot,
        created_at_snapshot = EXCLUDED.created_at_snapshot,
        batch_id = EXCLUDED.batch_id,
        imported_at = CURRENT_TIMESTAMP
    `, [
      crypto.randomUUID(), SOURCE_SYSTEM, account.sourceAccountId, identityId, account.name,
      account.type, money(account.balance), account.savingsGoal === null ? null : money(account.savingsGoal),
      account.color, account.sourceCreatedAt, batchId,
    ]);
  }

  for (const transaction of transactions) {
    const identityId = identityIds.get(transaction.sourceUserId);
    if (!identityId) throw new Error(`No existe identidad para la transacción ${transaction.sourceTransactionId}.`);
    await target.query(`
      INSERT INTO legacy_wallet_transaction (
        id, source_system, source_transaction_id, legacy_identity_id, amount,
        type_snapshot, status_snapshot, description_snapshot, occurred_at,
        redeemed_snapshot, batch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (source_system, source_transaction_id) DO UPDATE SET
        legacy_identity_id = EXCLUDED.legacy_identity_id,
        amount = EXCLUDED.amount,
        type_snapshot = EXCLUDED.type_snapshot,
        status_snapshot = EXCLUDED.status_snapshot,
        description_snapshot = EXCLUDED.description_snapshot,
        occurred_at = EXCLUDED.occurred_at,
        redeemed_snapshot = EXCLUDED.redeemed_snapshot,
        batch_id = EXCLUDED.batch_id,
        imported_at = CURRENT_TIMESTAMP
    `, [
      crypto.randomUUID(), SOURCE_SYSTEM, transaction.sourceTransactionId, identityId,
      money(transaction.amount), transaction.tipo, transaction.estado, transaction.descripcion,
      transaction.occurredAt, transaction.redeemed, batchId,
    ]);
  }
}

async function transferLinkedBalances(target, batchId) {
  const linked = (await target.query(`
    SELECT id, core_user_id AS "coreUserId", source_user_id AS "sourceUserId",
           source_wallet_balance::text AS balance
    FROM legacy_user_identity
    WHERE source_system = $1 AND match_status = 'LINKED_PENDING_CUTOVER'
    ORDER BY source_user_id
    FOR UPDATE
  `, [SOURCE_SYSTEM])).rows;

  let transferredTotal = 0;
  for (const identity of linked) {
    const walletResult = await target.query(`
      INSERT INTO wallet (id, user_id, currency, balance, updated_at)
      VALUES ($1, $2, 'DOP', 0, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET updated_at = wallet.updated_at
      RETURNING id
    `, [crypto.randomUUID(), identity.coreUserId]);
    const walletId = walletResult.rows[0].id;
    const archivedAccounts = (await target.query(`
      SELECT source_account_id AS "sourceAccountId", name_snapshot AS name,
             type_snapshot AS type, balance_snapshot::text AS balance,
             savings_goal_snapshot::text AS "savingsGoal", color_snapshot AS color,
             created_at_snapshot AS "sourceCreatedAt"
      FROM legacy_wallet_account
      WHERE legacy_identity_id = $1
      ORDER BY created_at_snapshot NULLS LAST, source_account_id
    `, [identity.id])).rows;
    const accounts = archivedAccounts.length ? archivedAccounts : [{
      sourceAccountId: `principal:${identity.sourceUserId}`,
      name: "Principal",
      type: "corriente",
      balance: "0",
      savingsGoal: null,
      color: null,
      sourceCreatedAt: null,
    }];
    const accountTotal = money(accounts.reduce((sum, account) => sum + money(account.balance), 0));
    if (accountTotal !== money(identity.balance)) {
      throw new Error(`Las cuentas archivadas de ${identity.sourceUserId} no cuadran con su wallet.`);
    }

    for (const account of accounts) {
      const normalizedType = normalize(account.type);
      const normalizedName = normalize(account.name);
      const kind = normalizedType === "ahorro" || (normalizedType !== "corriente" && normalizedName !== "principal")
        ? "SAVINGS"
        : "PRIMARY";
      const walletAccountResult = await target.query(`
        INSERT INTO wallet_account (
          id, wallet_id, name, kind, balance, savings_goal, color,
          source_system, source_account_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4::wallet_account_kind, 0, $5, $6, $7, $8, COALESCE($9, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
        ON CONFLICT (source_system, source_account_id) DO UPDATE SET
          wallet_id = EXCLUDED.wallet_id,
          name = EXCLUDED.name,
          kind = EXCLUDED.kind,
          savings_goal = EXCLUDED.savings_goal,
          color = EXCLUDED.color,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [
        crypto.randomUUID(), walletId, account.name, kind,
        account.savingsGoal === null ? null : money(account.savingsGoal), account.color,
        SOURCE_SYSTEM, account.sourceAccountId, account.sourceCreatedAt,
      ]);
      const walletAccountId = walletAccountResult.rows[0].id;
      const amount = money(account.balance);
      const externalKey = `${SOURCE_SYSTEM}:opening:${identity.sourceUserId}:account:${account.sourceAccountId}`;

      if (amount === 0) continue;
      const inserted = await target.query(`
        INSERT INTO wallet_ledger_entry (
          id, wallet_id, account_id, type, amount, description, external_key, batch_id, occurred_at
        ) VALUES ($1, $2, $3, 'LEGACY_OPENING_BALANCE', $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (external_key) DO NOTHING
        RETURNING id
      `, [
        crypto.randomUUID(), walletId, walletAccountId, amount,
        `Saldo inicial migrado de ${SOURCE_SYSTEM}: ${account.name}`, externalKey, batchId,
      ]);
      if (inserted.rowCount === 1) {
        await target.query("UPDATE wallet_account SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [amount, walletAccountId]);
        await target.query("UPDATE wallet SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [amount, walletId]);
        transferredTotal += amount;
      }
    }

    await target.query(`
      UPDATE legacy_user_identity
      SET match_status = 'TRANSFERRED', transferred_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [identity.id]);
  }
  return { count: linked.length, total: money(transferredTotal) };
}

async function main() {
  if (mode === "CUTOVER" && process.env.LEGACY_WALLET_WRITES_FROZEN !== "YES") {
    throw new Error("El corte requiere LEGACY_WALLET_WRITES_FROZEN=YES después de bloquear las escrituras del wallet anterior.");
  }
  const source = new Client({ connectionString: requiredEnv("SOURCE_DATABASE_URL"), application_name: "sdigitalcore-legacy-reader" });
  const target = new Client({ connectionString: requiredEnv("DATABASE_URL"), application_name: "sdigitalcore-legacy-migrator" });
  await Promise.all([source.connect(), target.connect()]);

  try {
    const snapshot = await readSource(source);
    const coreUsers = await readCoreUsers(target);
    const matches = buildMatches(snapshot.users, coreUsers);
    const report = {
      mode,
      sourceUsers: snapshot.users.length,
      sourceWallets: snapshot.walletCount,
      sourceAccounts: snapshot.accounts.length,
      sourcePrimaryAccounts: snapshot.accounts.filter((account) => normalize(account.type) === "corriente" || normalize(account.name) === "principal").length,
      sourceSavingsAccounts: snapshot.accounts.filter((account) => normalize(account.type) === "ahorro").length,
      sourceTransactions: snapshot.transactions.length,
      walletHeaderTotal: snapshot.walletTotal,
      accountTotal: snapshot.accountTotal,
      balancesReconcile: snapshot.walletTotal === snapshot.accountTotal,
      suggested: matches.filter((item) => item.status === "SUGGESTED").length,
      conflicts: matches.filter((item) => item.status === "CONFLICT").length,
      unmatched: matches.filter((item) => item.status === "UNMATCHED").length,
      candidates: matches.filter((item) => item.candidate).map((item) => ({
        legacy: item.legacy.username,
        core: item.candidate.username ?? item.candidate.email,
        method: item.method,
      })),
    };
    console.log(JSON.stringify(report, null, 2));

    if (!snapshot.users.length) throw new Error("La fuente no contiene usuarios; se canceló la migración.");
    if (!report.balancesReconcile) throw new Error("El saldo de wallet no coincide con la suma de sus cuentas.");
    if (mode === "DRY_RUN") return;

    await target.query("BEGIN");
    if (mode === "CUTOVER") {
      const priorCutover = (await target.query(`
        SELECT id, checksum FROM legacy_migration_batch
        WHERE source_system = $1 AND mode = 'CUTOVER' AND status = 'COMPLETED'
        ORDER BY completed_at DESC
        LIMIT 1
      `, [SOURCE_SYSTEM])).rows[0];
      if (priorCutover) {
        await target.query("ROLLBACK");
        console.log(JSON.stringify({ success: true, alreadyCutOver: true, batchId: priorCutover.id }, null, 2));
        return;
      }
    }
    const batchId = await insertBatch(target, snapshot, mode);
    await syncSnapshot(target, batchId, matches, snapshot.transactions, snapshot.accounts);
    const transfer = mode === "CUTOVER" ? await transferLinkedBalances(target, batchId) : { count: 0, total: 0 };
    await target.query(`
      UPDATE legacy_migration_batch
      SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP,
          cutoff_at = CASE WHEN mode = 'CUTOVER' THEN CURRENT_TIMESTAMP ELSE cutoff_at END,
          transferred_user_count = $2, transferred_balance_total = $3
      WHERE id = $1
    `, [batchId, transfer.count, transfer.total]);
    await target.query("COMMIT");
    console.log(JSON.stringify({ success: true, batchId, transfer }, null, 2));
  } catch (error) {
    if (mode !== "DRY_RUN") await target.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
