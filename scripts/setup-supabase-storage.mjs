/**
 * Create Supabase Storage buckets for House of Rivana.
 *
 * Requires in .env / .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: npm run storage:setup
 *
 * After buckets exist, run supabase/storage-setup.sql in the SQL Editor
 * (or re-run it — it is idempotent) to apply RLS policies.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const root = resolve(import.meta.dirname, "..");
const env = {
  ...loadEnvFile(resolve(root, ".env")),
  ...loadEnvFile(resolve(root, ".env.local")),
  ...process.env,
};

const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
const productBucket = env.SUPABASE_PRODUCT_BUCKET || "product-images";
const proofBucket = env.SUPABASE_PROOF_BUCKET || "payment-proofs";

if (!url || !serviceKey) {
  console.error(`
Missing Supabase credentials.

1. Create a project at https://supabase.com/dashboard
2. Project Settings → API:
   - Project URL          → NEXT_PUBLIC_SUPABASE_URL
   - anon public          → NEXT_PUBLIC_SUPABASE_ANON_KEY
   - service_role secret  → SUPABASE_SERVICE_ROLE_KEY  (keep private)
3. Paste them into .env and .env.local, then re-run:

   npm run storage:setup
`);
  process.exit(1);
}

const buckets = [
  {
    id: productBucket,
    name: productBucket,
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  },
  {
    id: proofBucket,
    name: proofBucket,
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
  },
];

async function upsertBucket(bucket) {
  const listRes = await fetch(`${url}/storage/v1/bucket`, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  });
  if (!listRes.ok) {
    const body = await listRes.text();
    throw new Error(`List buckets failed (${listRes.status}): ${body}`);
  }
  const existing = await listRes.json();
  const found = Array.isArray(existing)
    ? existing.find((b) => b.id === bucket.id || b.name === bucket.name)
    : null;

  if (found) {
    const updateRes = await fetch(`${url}/storage/v1/bucket/${bucket.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public: bucket.public,
        fileSizeLimit: bucket.fileSizeLimit,
        allowedMimeTypes: bucket.allowedMimeTypes,
      }),
    });
    if (!updateRes.ok) {
      const body = await updateRes.text();
      // Some projects reject PUT; treat as success if bucket already exists
      console.warn(`  · update ${bucket.id}: ${updateRes.status} ${body}`);
      return "exists";
    }
    return "updated";
  }

  const createRes = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bucket),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Create ${bucket.id} failed (${createRes.status}): ${body}`);
  }
  return "created";
}

console.log(`Supabase project: ${url}`);
for (const bucket of buckets) {
  const status = await upsertBucket(bucket);
  console.log(
    `  ✓ ${bucket.id} (${bucket.public ? "public" : "private"}) — ${status}`,
  );
}

console.log(`
Buckets ready.

Next: apply RLS policies once in the SQL Editor:
  supabase/storage-setup.sql

Then restart the Next.js dev server and open a product → Photographs.
`);
