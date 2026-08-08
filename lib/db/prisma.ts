import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const configuredConnectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/sdigitalcore";

  const connectionString = resolveSupabaseConnectionString(
    configuredConnectionString,
  );

  const pool = new Pool({
    connectionString,
    ...(connectionString.includes(".pooler.supabase.com")
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function resolveSupabaseConnectionString(connectionString: string): string {
  if (process.env.NODE_ENV !== "production") return connectionString;

  try {
    const url = new URL(connectionString);
    const directHostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (!directHostMatch) return connectionString;

    const projectRef = directHostMatch[1];
    const region = process.env.SUPABASE_DB_REGION || "us-west-1";
    url.hostname = `aws-0-${region}.pooler.supabase.com`;
    url.port = "6543";
    url.username = `postgres.${projectRef}`;
    url.searchParams.set("pgbouncer", "true");
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return connectionString;
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
