import { randomBytes, timingSafeEqual } from "node:crypto";
import { customAlphabet } from "nanoid";

/** Unambiguous alphabet: no O/0/I/1 so numbers read cleanly over the phone. */
const humanAlphabet = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";
const humanId = customAlphabet(humanAlphabet, 6);

/**
 * Order numbers look like HOR-2026-K4T9QX: readable, year-scoped, and random
 * enough that customers cannot enumerate other people's orders.
 */
export function generateOrderNumber(date = new Date()) {
  return `HOR-${date.getFullYear()}-${humanId()}`;
}

export function generateSku(prefix: string, suffix?: string) {
  const base = prefix
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6)
    .padEnd(3, "X");
  return [base, suffix?.toUpperCase().replace(/[^A-Z0-9]+/g, ""), humanId()]
    .filter(Boolean)
    .join("-");
}

/** Opaque token guests use to open their order page without an account. */
export function generateAccessToken() {
  return randomBytes(24).toString("base64url");
}

export function generateCartToken() {
  return randomBytes(18).toString("base64url");
}

/** Constant-time comparison so token checks cannot be timed. */
export function safeTokenEqual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
