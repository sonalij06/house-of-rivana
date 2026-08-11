/**
 * One interface, two adapters. The storefront and admin never branch on the
 * provider directly — they resolve it from SiteSetting.activePaymentProvider and
 * call through this contract, so swapping manual UPI for Razorpay is a settings
 * change rather than a code change.
 */

export type PaymentProviderId = "manual_upi" | "razorpay";

export type OrderContext = {
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** When the stock hold lapses; the intent should not outlive it. */
  expiresAt: Date;
};

/** Everything the payment screen needs to render, whichever provider is live. */
export type PaymentIntent =
  | {
      kind: "upi_uri";
      paymentId: string;
      uri: string;
      qrDataUrl: string;
      payeeVpa: string;
      payeeName: string;
      amountPaise: number;
      expiresAt: Date;
    }
  | {
      kind: "razorpay_checkout";
      paymentId: string;
      providerOrderId: string;
      keyId: string;
      amountPaise: number;
      expiresAt: Date;
    };

export type ProofInput = {
  orderId: string;
  paymentId: string;
  /** Twelve-digit UPI reference from the payer's app. */
  utr: string;
  payerVpa?: string;
  payerName?: string;
  proofPath?: string;
  proofMimeType?: string;
};

export type VerifyInput = {
  paymentId: string;
  /** The staff member who matched the reference against the bank statement. */
  verifiedById: string;
  note?: string;
};

export type PaymentResult =
  | { ok: true; status: "UNDER_REVIEW" | "PAID" | "REFUNDED" | "PARTIALLY_REFUNDED"; message: string }
  | { ok: false; error: string };

export type WebhookResult =
  | { handled: true; event: string; orderNumber?: string; duplicate?: boolean }
  | { handled: false; reason: string };

export interface PaymentProvider {
  id: PaymentProviderId;
  /** Shown on the payment screen and in the admin order view. */
  label: string;
  createIntent(order: OrderContext): Promise<PaymentIntent>;
  /** Manual UPI only: the buyer supplies evidence we verify by hand. */
  submitProof?(input: ProofInput): Promise<PaymentResult>;
  /** Manual UPI only: an operator confirms the money arrived. */
  verifyProof?(input: VerifyInput): Promise<PaymentResult>;
  /** Razorpay only: the gateway tells us, and we verify the signature first. */
  handleWebhook?(rawBody: string, signature: string | null): Promise<WebhookResult>;
  refund?(paymentId: string, amountPaise: number): Promise<PaymentResult>;
}

export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}
