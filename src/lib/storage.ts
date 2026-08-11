import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { env, features } from "@/lib/env";

/**
 * Product photography (and hero / review snaps that reuse the same helper) are
 * stored as BYTEA rows in Postgres and served from `/api/media/[id]`.
 *
 * Payment proofs stay on Supabase Storage when credentials are present — they
 * are private and need short-lived signed URLs. Without Supabase the manual UPI
 * flow still works with the UTR alone.
 */

let client: SupabaseClient | null = null;

function serviceClient() {
  if (!features.supabaseStorage) return null;
  client ??= createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  return client;
}

export const PROOF_BUCKET = env.SUPABASE_PROOF_BUCKET;
export const PRODUCT_BUCKET = env.SUPABASE_PRODUCT_BUCKET;

/** Product image uploads always work when the database is up. */
export const storageConfigured = true;

export type UploadResult =
  | { ok: true; path: string; publicUrl?: string }
  | { ok: false; error: string };

const MAX_PRODUCT_BYTES = 8 * 1024 * 1024;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const PRODUCT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function publicMediaUrl(id: string) {
  return `/api/media/${id}`;
}

/** Pulls the StoredImage id out of `/api/media/<id>` (with optional query/hash). */
export function mediaIdFromUrl(pathOrUrl: string) {
  try {
    const pathname = pathOrUrl.startsWith("http")
      ? new URL(pathOrUrl).pathname
      : pathOrUrl.split("?")[0]?.split("#")[0] ?? pathOrUrl;
    const match = pathname.match(/^\/api\/media\/([^/]+)\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function validateProofFile(file: { size: number; type: string }) {
  if (file.size > MAX_PROOF_BYTES) {
    return "That file is over 5 MB. A screenshot is usually well under 1 MB.";
  }
  if (!PROOF_TYPES.has(file.type)) {
    return "Upload a JPEG, PNG, WebP or PDF.";
  }
  return null;
}

/** Payment screenshots. Path is namespaced by order so cleanup is trivial. */
export async function uploadPaymentProof(
  orderNumber: string,
  file: File,
): Promise<UploadResult> {
  const supabase = serviceClient();
  if (!supabase) {
    return { ok: false, error: "File uploads are not configured on this deployment." };
  }

  const invalid = validateProofFile(file);
  if (invalid) return { ok: false, error: invalid };

  const extension = file.name.split(".").pop()?.toLowerCase().slice(0, 5) || "jpg";
  const path = `${orderNumber}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    console.error("proof upload failed", error);
    return { ok: false, error: "We could not store that file. Try again, or send only the reference." };
  }

  return { ok: true, path };
}

/**
 * Signed read URL for a private object. Staff-only by construction: nothing in
 * the storefront calls this.
 */
export async function signedProofUrl(path: string, expiresInSeconds = 300) {
  const supabase = serviceClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("signed url failed", error);
    return null;
  }
  return data.signedUrl;
}

/** Product photography — bytes in Postgres, public URL via the media route. */
export async function uploadProductImage(
  slug: string,
  file: File,
): Promise<UploadResult> {
  if (!PRODUCT_TYPES.has(file.type)) {
    return { ok: false, error: "Upload a JPEG, PNG, WebP or GIF." };
  }
  if (file.size > MAX_PRODUCT_BYTES) {
    return { ok: false, error: "Images must be under 8 MB." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase().slice(0, 5) || "jpg";
  const path = `${slug}/${Date.now()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const stored = await prisma.storedImage.create({
      data: {
        path,
        mimeType: file.type || "application/octet-stream",
        bytes,
        byteSize: bytes.byteLength,
      },
      select: { id: true, path: true },
    });

    return { ok: true, path: stored.path, publicUrl: publicMediaUrl(stored.id) };
  } catch (error) {
    console.error("product image upload failed", error);
    return { ok: false, error: "We could not store that image." };
  }
}

/**
 * Accepts either a storage path or the public URL we stored on ProductImage, so
 * callers do not have to remember which one they are holding.
 */
export async function deleteProductImage(pathOrUrl: string) {
  const id = mediaIdFromUrl(pathOrUrl);
  if (id) {
    await prisma.storedImage.deleteMany({ where: { id } });
    return;
  }

  // Legacy Supabase public URLs from before the Postgres migration — best-effort.
  const supabase = serviceClient();
  if (supabase) {
    const legacyPath = storagePathFromUrl(pathOrUrl, PRODUCT_BUCKET) ?? pathOrUrl;
    await supabase.storage.from(PRODUCT_BUCKET).remove([legacyPath]);
  }

  await prisma.storedImage.deleteMany({ where: { path: pathOrUrl } });
}

/** Public URLs look like …/storage/v1/object/public/<bucket>/<path>. */
export function storagePathFromUrl(url: string, bucket: string) {
  const marker = `/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}
