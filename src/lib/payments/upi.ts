/**
 * UPI deep-link construction. Kept separate from the adapter so it can be unit
 * tested without a database, and reused by the Razorpay QR fallback.
 */

export type UpiLinkInput = {
  payeeVpa: string;
  payeeName: string;
  amountPaise: number;
  /** Appears as the transaction note in the payer's app. */
  note: string;
  /** Merchant reference, echoed back in the payer's statement. */
  reference: string;
};

const VPA_PATTERN = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidVpa(vpa: string) {
  return VPA_PATTERN.test(vpa.trim());
}

/**
 * UTRs are the 12-digit reference UPI apps show after a transfer. Some banks
 * prefix them, so we compare on digits only.
 */
export function normaliseUtr(input: string) {
  return input.replace(/[^\d]/g, "");
}

export function isValidUtr(input: string) {
  return /^\d{12}$/.test(normaliseUtr(input));
}

/**
 * Builds a `upi://pay` link. Amounts must be rupees with two decimals — several
 * major apps silently reject an integer or a three-decimal amount.
 */
export function buildUpiUri(input: UpiLinkInput) {
  const params = new URLSearchParams({
    pa: input.payeeVpa.trim(),
    pn: input.payeeName.trim(),
    am: (input.amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: input.note.slice(0, 50),
    tr: input.reference.slice(0, 35),
  });
  return `upi://pay?${params.toString()}`;
}
