import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { appendTimeline } from "@/lib/orders";
import { buildUpiUri, isValidUtr, isValidVpa, normaliseUtr } from "@/lib/payments/upi";
import {
  PaymentConfigError,
  type OrderContext,
  type PaymentIntent,
  type PaymentProvider,
  type PaymentResult,
  type ProofInput,
  type VerifyInput,
} from "@/lib/payments/types";

/**
 * Manual UPI: we hand the buyer a payment link and a QR, they pay from their own
 * app, then submit the UTR and optionally a screenshot. Nothing is trusted — the
 * order sits in PAYMENT_UNDER_REVIEW until a human matches the UTR against the
 * bank statement in the admin queue.
 */
export const manualUpiProvider: PaymentProvider = {
  id: "manual_upi",
  label: "UPI transfer",

  async createIntent(order: OrderContext): Promise<PaymentIntent> {
    const settings = await getSettings();

    if (!settings.upiVpa || !isValidVpa(settings.upiVpa)) {
      throw new PaymentConfigError(
        "No UPI ID is configured. Add one in Admin → Settings before taking orders.",
      );
    }

    const uri = buildUpiUri({
      payeeVpa: settings.upiVpa,
      payeeName: settings.upiPayeeName || settings.brandName,
      amountPaise: order.amountPaise,
      note: `Order ${order.orderNumber}`,
      reference: order.orderNumber,
    });

    const qrDataUrl = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 480,
      color: { dark: "#1a1a1aff", light: "#ffffffff" },
    });

    // One live payment attempt per order: reuse the row so a page refresh does
    // not litter the admin queue with duplicates.
    const existing = await prisma.payment.findFirst({
      where: {
        orderId: order.orderId,
        provider: "MANUAL_UPI",
        status: { in: ["INITIATED", "AWAITING_CONFIRMATION", "UNDER_REVIEW"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const payment = existing
      ? await prisma.payment.update({
          where: { id: existing.id },
          data: { amountPaise: order.amountPaise, expiresAt: order.expiresAt },
        })
      : await prisma.payment.create({
          data: {
            orderId: order.orderId,
            provider: "MANUAL_UPI",
            status: "AWAITING_CONFIRMATION",
            method: "upi",
            amountPaise: order.amountPaise,
            upiVpa: settings.upiVpa,
            expiresAt: order.expiresAt,
          },
        });

    if (!existing) {
      await appendTimeline(order.orderId, {
        type: "PAYMENT_INITIATED",
        message: `UPI payment link issued for ${order.orderNumber}.`,
      });
    }

    return {
      kind: "upi_uri",
      paymentId: payment.id,
      uri,
      qrDataUrl,
      payeeVpa: settings.upiVpa,
      payeeName: settings.upiPayeeName || settings.brandName,
      amountPaise: order.amountPaise,
      expiresAt: order.expiresAt,
    };
  },

  async submitProof(input: ProofInput): Promise<PaymentResult> {
    if (!isValidUtr(input.utr)) {
      return {
        ok: false,
        error: "A UPI reference is 12 digits. Check your payment app and try again.",
      };
    }
    const utr = normaliseUtr(input.utr);

    const payment = await prisma.payment.findFirst({
      where: { id: input.paymentId, orderId: input.orderId },
      include: { order: { select: { orderNumber: true, status: true } } },
    });
    if (!payment) return { ok: false, error: "That payment could not be found." };

    if (payment.status === "PAID") {
      return { ok: false, error: "This order has already been paid." };
    }

    // The same UTR cannot back two orders — that is the classic manual-UPI fraud.
    const reused = await prisma.payment.findFirst({
      where: { upiUtr: utr, orderId: { not: input.orderId } },
      select: { order: { select: { orderNumber: true } } },
    });
    if (reused) {
      return {
        ok: false,
        error: "That reference is already recorded against another order.",
      };
    }

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "UNDER_REVIEW",
          upiUtr: utr,
          payerName: input.payerName?.trim() || null,
          proofPath: input.proofPath ?? null,
          proofMimeType: input.proofMimeType ?? null,
          ...(input.payerVpa && isValidVpa(input.payerVpa)
            ? { upiVpa: input.payerVpa.trim() }
            : {}),
        },
      }),
      prisma.order.update({
        where: { id: input.orderId },
        data: { status: "PAYMENT_UNDER_REVIEW" },
      }),
    ]);

    await appendTimeline(input.orderId, {
      type: "PAYMENT_PROOF_SUBMITTED",
      message: `Buyer submitted UPI reference ${utr}${input.proofPath ? " with a screenshot" : ""}.`,
      metadata: { utr, hasProof: Boolean(input.proofPath) },
    });

    return {
      ok: true,
      status: "UNDER_REVIEW",
      message:
        "Thank you — we are matching your reference against our account. You will hear from us within a few hours.",
    };
  },

  async verifyProof(input: VerifyInput): Promise<PaymentResult> {
    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      select: { id: true, status: true, upiUtr: true, amountPaise: true },
    });
    if (!payment) return { ok: false, error: "That payment could not be found." };
    if (payment.status === "PAID") {
      return { ok: true, status: "PAID", message: "Already marked as paid." };
    }
    if (payment.status !== "UNDER_REVIEW") {
      return {
        ok: false,
        error: "Only a payment awaiting review can be verified.",
      };
    }
    if (!payment.upiUtr) {
      return { ok: false, error: "There is no UPI reference on this payment." };
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        verifiedById: input.verifiedById,
        verifiedAt: new Date(),
        rejectionReason: null,
      },
    });

    return { ok: true, status: "PAID", message: "Payment marked as received." };
  },

  async refund(paymentId: string, amountPaise: number): Promise<PaymentResult> {
    // Manual UPI refunds happen in the bank app; we only record the outcome so
    // the ledger and the customer's order page agree.
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return { ok: false, error: "That payment could not be found." };
    if (payment.status !== "PAID" && payment.status !== "PARTIALLY_REFUNDED") {
      return { ok: false, error: "Only a paid payment can be refunded." };
    }

    const alreadyRefunded = payment.refundedPaise;
    const refundable = payment.amountPaise - alreadyRefunded;
    if (amountPaise <= 0 || amountPaise > refundable) {
      return { ok: false, error: `Refundable amount is ${refundable / 100} rupees.` };
    }

    const refundedPaise = alreadyRefunded + amountPaise;
    const fullyRefunded = refundedPaise >= payment.amountPaise;

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundedPaise,
        status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });

    return {
      ok: true,
      status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      message: fullyRefunded
        ? "Recorded as fully refunded."
        : "Recorded as partially refunded.",
    };
  },
};
