import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const username = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim().toLowerCase();
const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const connectionString = process.env.DATABASE_URL;

if (!connectionString || !email || !username || !name || !password || password.length < 12) {
  throw new Error("Configura DATABASE_URL y ADMIN_BOOTSTRAP_EMAIL/USERNAME/NAME/PASSWORD. La contraseña debe tener al menos 12 caracteres.");
}

const salt = randomBytes(16).toString("hex");
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
const pool = new Pool({
  connectionString,
  ...(connectionString.includes(".supabase.co") || connectionString.includes(".pooler.supabase.com")
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

const client = await pool.connect();

try {
  await client.query("BEGIN");
  const conflict = await client.query(
    'SELECT id FROM "user" WHERE lower(email) = $1 OR lower(username) = $2 FOR UPDATE',
    [email, username],
  );
  if (conflict.rowCount > 1) throw new Error("El correo y el usuario pertenecen a cuentas diferentes.");

  const allowedModules = ["almacen", "precios", "facturas", "configuracion"];
  if (conflict.rowCount === 1) {
    await client.query(
      'UPDATE "user" SET name=$1, username=$2, email=$3, password_hash=$4, role_code=$5, allowed_modules=$6, status=$7, updated_at=NOW() WHERE id=$8',
      [name, username, email, passwordHash, "ADMIN", allowedModules, "ACTIVE", conflict.rows[0].id],
    );
  } else {
    await client.query(
      'INSERT INTO "user" (id, name, username, email, password_hash, role_code, allowed_modules, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())',
      [randomUUID(), name, username, email, passwordHash, "ADMIN", allowedModules, "ACTIVE"],
    );
  }
  await client.query("COMMIT");
  console.log(`Administrador real configurado: ${email}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
