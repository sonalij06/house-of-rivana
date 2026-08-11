import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env, isProd } from "@/lib/env";

/**
 * Prisma 7 requires a driver adapter. In serverless the app connects through the
 * pooled Supabase URL (port 6543 / pgbouncer), while migrations use DIRECT_URL.
 */
function createClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // Keep the pool small: every serverless instance opens its own.
    max: isProd ? 5 : 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

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
