import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env, isProd } from "@/lib/env";

/**
 * Prisma 7 requires a driver adapter. In serverless the app connects through the
 * pooled Supabase URL (port 6543 / pgbouncer), while migrations use DIRECT_URL.
 */
function createClient() {
  const isLocal =
    /localhost|127\.0\.0\.1/.test(env.DATABASE_URL) ||
    env.DATABASE_URL.includes("@db:");

  // pg 8 treats sslmode=require as verify-full; strip it so our ssl option applies.
  const connectionString = (() => {
    try {
      const url = new URL(env.DATABASE_URL);
      url.searchParams.delete("sslmode");
      url.searchParams.delete("uselibpqcompat");
      return url.toString();
    } catch {
      return env.DATABASE_URL.replace(/([?&])sslmode=[^&]*/gi, "").replace(
        /\?$/,
        "",
      );
    }
  })();

  const pool = new Pool({
    connectionString,
    // Keep the pool small: every serverless instance opens its own.
    max: isProd ? 5 : 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: isProd ? ["error"] : ["warn", "error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (!isProd) globalForPrisma.prisma = prisma;

export * from "@/generated/prisma/enums";
export type { Prisma } from "@/generated/prisma/client";
