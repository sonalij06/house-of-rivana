import { z } from "zod";

/**
 * Server-side environment contract. Anything optional here degrades gracefully:
 * missing Razorpay keys simply keep the manual UPI provider active, missing Resend
 * keys make notifications log-only, and so on. Only the database and auth secret
 * are genuinely required to boot.
 */
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** Pooled connection for the running app (Supabase/Neon pooler on Vercel). */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Direct (non-pooled) URL for `prisma migrate deploy` on Vercel builds. */
  DIRECT_URL: z.string().optional(),

  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_PRODUCT_BUCKET: z.string().default("product-images"),
  SUPABASE_PROOF_BUCKET: z.string().default("payment-proofs"),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("House of Rivana <orders@houseofrivana.com>"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_BUSINESS_NUMBER: z.string().optional(),

  CRON_SECRET: z.string().optional(),

  /** Shiprocket API user (Settings → API → Create an API User). */
  SHIPROCKET_EMAIL: z.string().email().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  /** Pickup location nickname exactly as saved in the Shiprocket panel. */
  SHIPROCKET_PICKUP_LOCATION: z.string().default("Primary"),
  SHIPROCKET_PICKUP_PINCODE: z.string().default("302001"),
  /** Shared secret Shiprocket sends as `x-api-key` on tracking webhooks. */
  SHIPROCKET_WEBHOOK_TOKEN: z.string().optional(),

  /** Self-hosted or SaaS Sentry DSN (server). Prefer NEXT_PUBLIC for browser. */
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default("local-docker"),
  SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
  /** When true, exposes /sentry-test probes (local coverage only). */
  SENTRY_ENABLE_TEST_PAGE: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

function emptyToUndefined(value: string | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const raw = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: emptyToUndefined(process.env.DIRECT_URL),
  NEXT_PUBLIC_APP_URL: emptyToUndefined(process.env.NEXT_PUBLIC_APP_URL),
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: emptyToUndefined(process.env.BETTER_AUTH_URL),
  GOOGLE_CLIENT_ID: emptyToUndefined(process.env.GOOGLE_CLIENT_ID),
  GOOGLE_CLIENT_SECRET: emptyToUndefined(process.env.GOOGLE_CLIENT_SECRET),
  NEXT_PUBLIC_SUPABASE_URL: emptyToUndefined(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: emptyToUndefined(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  SUPABASE_SERVICE_ROLE_KEY: emptyToUndefined(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ),
  SUPABASE_PRODUCT_BUCKET: emptyToUndefined(process.env.SUPABASE_PRODUCT_BUCKET),
  SUPABASE_PROOF_BUCKET: emptyToUndefined(process.env.SUPABASE_PROOF_BUCKET),
  RAZORPAY_KEY_ID: emptyToUndefined(process.env.RAZORPAY_KEY_ID),
  RAZORPAY_KEY_SECRET: emptyToUndefined(process.env.RAZORPAY_KEY_SECRET),
  RAZORPAY_WEBHOOK_SECRET: emptyToUndefined(process.env.RAZORPAY_WEBHOOK_SECRET),
  RESEND_API_KEY: emptyToUndefined(process.env.RESEND_API_KEY),
  EMAIL_FROM: emptyToUndefined(process.env.EMAIL_FROM),
  WHATSAPP_PHONE_NUMBER_ID: emptyToUndefined(
    process.env.WHATSAPP_PHONE_NUMBER_ID,
  ),
  WHATSAPP_ACCESS_TOKEN: emptyToUndefined(process.env.WHATSAPP_ACCESS_TOKEN),
  WHATSAPP_BUSINESS_NUMBER: emptyToUndefined(
    process.env.WHATSAPP_BUSINESS_NUMBER,
  ),
  CRON_SECRET: emptyToUndefined(process.env.CRON_SECRET),
  SHIPROCKET_EMAIL: emptyToUndefined(process.env.SHIPROCKET_EMAIL),
  SHIPROCKET_PASSWORD: emptyToUndefined(process.env.SHIPROCKET_PASSWORD),
  SHIPROCKET_PICKUP_LOCATION: emptyToUndefined(
    process.env.SHIPROCKET_PICKUP_LOCATION,
  ),
  SHIPROCKET_PICKUP_PINCODE: emptyToUndefined(
    process.env.SHIPROCKET_PICKUP_PINCODE,
  ),
  SHIPROCKET_WEBHOOK_TOKEN: emptyToUndefined(
    process.env.SHIPROCKET_WEBHOOK_TOKEN,
  ),
  SENTRY_DSN: emptyToUndefined(process.env.SENTRY_DSN),
  NEXT_PUBLIC_SENTRY_DSN: emptyToUndefined(
    process.env.NEXT_PUBLIC_SENTRY_DSN,
  ),
  SENTRY_ENVIRONMENT: emptyToUndefined(process.env.SENTRY_ENVIRONMENT),
  SENTRY_TRACES_SAMPLE_RATE: emptyToUndefined(
    process.env.SENTRY_TRACES_SAMPLE_RATE,
  ),
  SENTRY_ENABLE_TEST_PAGE: emptyToUndefined(
    process.env.SENTRY_ENABLE_TEST_PAGE,
  ),
};

const parsed = serverSchema.safeParse(raw);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env.local and fill in the required values.`,
  );
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";

export const features = {
  razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  razorpayWebhook: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
  /** Private payment-proof bucket only — product photos use Postgres. */
  supabaseStorage: Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
  ),
  email: Boolean(env.RESEND_API_KEY),
  whatsapp: Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN),
  googleAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  shiprocket: Boolean(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD),
  sentry: Boolean(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN),
  sentryTestPage: env.SENTRY_ENABLE_TEST_PAGE === true,
} as const;
