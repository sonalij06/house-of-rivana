import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI config (migrate / studio / seed).
 *
 * On Vercel + Supabase/Neon:
 *   DIRECT_URL  → direct Postgres (port 5432) for DDL / migrate deploy
 *   DATABASE_URL → pooled URL used only by the running Next.js app (src/lib/db.ts)
 *
 * Local Docker uses the same connection string for both.
 */
const datasourceUrl =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!datasourceUrl) {
  throw new Error(
    "Set DIRECT_URL (preferred) or DATABASE_URL for Prisma CLI. See .env.example.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
  },
});
