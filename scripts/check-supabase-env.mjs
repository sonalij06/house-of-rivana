import fs from "node:fs";

function get(file, key) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  return (match?.[1] ?? "").replace(/^["']|["']$/g, "").trim();
}

for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  console.log(file, {
    urlLen: get(file, "NEXT_PUBLIC_SUPABASE_URL").length,
    anonLen: get(file, "NEXT_PUBLIC_SUPABASE_ANON_KEY").length,
    serviceLen: get(file, "SUPABASE_SERVICE_ROLE_KEY").length,
    productBucket: get(file, "SUPABASE_PRODUCT_BUCKET") || "(default)",
    proofBucket: get(file, "SUPABASE_PROOF_BUCKET") || "(default)",
  });
}
