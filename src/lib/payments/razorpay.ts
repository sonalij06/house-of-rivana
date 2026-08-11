import Razorpay from "razorpay";
import { prisma } from "@/lib/db";
import { env, features } from "@/lib/env";
import { appendTimeline } from "@/lib/orders";
import {
  PaymentConfigError,
  type OrderContext,
  type PaymentIntent,
  type PaymentProvider,
  type PaymentResult,
  type WebhookResult,
} from "@/lib/payments/types";

/**
 * Razorpay Standard Checkout. UPI Collect was withdrawn on 28 Feb 2026, so this
 * adapter relies on UPI Intent and QR, both of which Standard Checkout renders
 * without any extra work on our side.
 *
 * Nothing here trusts the browser. The client handler is only a hint that the
 * flow finished; the order is confirmed by the signed `payment.captured` webhook.
 */

let client: Razorpay | null = null;

function api() {
  if (!features.razorpay) {
    throw new PaymentConfigError(
      "Razorpay keys are not configured. Switch to UPI transfer in Admin → Settings.",
    );
  }
  client ??= new Razorpay({
    key_id: env.RAZORPAY_KEY_ID!,
    key_secret: env.RAZORPAY_KEY_SECRET!,
  });
  return client;
}

export const razorpayProvider: PaymentProvider = {
  id: "razorpay",
  label: "UPI, card or netbanking",

  async createIntent(order: OrderContext): Promise<PaymentIntent> {
    const razorpay = api();

    const existing = await prisma.payment.findFirst({
      where: {
        orderId: order.orderId,
        provider: "RAZORPAY",
        status: { in: ["INITIATED", "AWAITING_CONFIRMATION"] },
        providerOrderId: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing?.providerOrderId && existing.amountPaise === order.amountPaise) {
      return {
        kind: "razorpay_checkout",
        paymentId: existing.id,
        providerOrderId: existing.providerOrderId,
        keyId: env.RAZORPAY_KEY_ID!,
        amountPaise: order.amountPaise,
        expiresAt: order.expiresAt,
      };
    }

    const providerOrder = await razorpay.orders.create({
      amount: order.amountPaise,
      currency: "INR",
      receipt: order.orderNumber,
      notes: { orderNumber: order.orderNumber, orderId: order.orderId },
    });

    const payment = await prisma.payment.create({
      data: {
        orderId: order.orderId,
        provider: "RAZORPAY",
        status: "AWAITING_CONFIRMATION",
        method: "upi",
        amountPaise: order.amountPaise,
        providerOrderId: providerOrder.id,
        expiresAt: order.expiresAt,
        rawPayload: providerOrder as unknown as object,
      },
    });

    await appendTimeline(order.orderId, {
      type: "PAYMENT_INITIATED",
      message: `Razorpay order ${providerOrder.id} created.`,
      metadata: { providerOrderId: providerOrder.id },
      isCustomerVisible: false,
    });

    return {
      kind: "razorpay_checkout",
      paymentId: payment.id,
      providerOrderId: providerOrder.id,
      keyId: env.RAZORPAY_KEY_ID!,
      amountPaise: order.amountPaise,
      expiresAt: order.expiresAt,
    };
  },

  /**
   * Verifies the HMAC before any read of the body, records the event for
   * idempotency, then applies it. Replays are acknowledged but not re-applied.
   */
  async handleWebhook(rawBody: string, signature: string | null): Promise<WebhookResult> {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      return { handled: false, reason: "Webhook secret is not configured." };
    }
    if (!signature) {
      return { handled: false, reason: "Missing signature header." };
    }

    const valid = Razorpay.validateWebhookSignature(
      rawBody,
      signature,
      env.RAZORPAY_WEBHOOK_SECRET,
    );
    if (!valid) return { handled: false, reason: "Signature verification failed." };

    let parsed: RazorpayWebhookBody;
    try {
      parsed = JSON.parse(rawBody) as RazorpayWebhookBody;
    } catch {
      return { handled: false, reason: "Body is not valid JSON." };
    }

    const event = parsed.event;
    const entity = parsed.payload?.payment?.entity;
    if (!entity) return { handled: false, reason: `No payment entity on ${event}.` };

    // The gateway retries until it gets a 2xx, so the same event can arrive many
    // times. The unique eventId makes the second arrival a no-op.
    const eventId = `${event}:${entity.id}`;
    const key = { provider_eventId: { provider: "RAZORPAY", eventId } };

    const seen = await prisma.webhookEvent.findUnique({ where: key });
    if (seen?.processedAt) {
      return { handled: true, event, duplicate: true };
    }

    await prisma.webhookEvent.upsert({
      where: key,
      create: {
        eventId,
        provider: "RAZORPAY",
        eventType: event,
        signatureOk: true,
        payload: parsed as unknown as object,
      },
      update: { payload: parsed as unknown as object, signatureOk: true },
    });

    const payment = await prisma.payment.findFirst({
      where: { providerOrderId: entity.order_id },
      include: { order: { select: { id: true, orderNumber: true, status: true } } },
    });
    if (!payment) {
      await markProcessed(eventId, `No local payment for ${entity.order_id}.`);
      return { handled: false, reason: `Unknown Razorpay order ${entity.order_id}.` };
    }

    if (event === "payment.captured") {
      // Amount is re-checked against our own order: a tampered or partial
      // capture must not confirm a shipment.
      if (entity.amount !== payment.amountPaise) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "UNDER_REVIEW",
            providerPaymentId: entity.id,
            failureReason: `Captured ${entity.amount} against an expected ${payment.amountPaise}.`,
            rawPayload: entity as unknown as object,
          },
        });
        await prisma.order.update({
          where: { id: payment.orderId },
          data: { status: "PAYMENT_UNDER_REVIEW" },
        });
        await appendTimeline(payment.orderId, {
          type: "PAYMENT_PROOF_SUBMITTED",
          message: `Razorpay captured a mismatched amount; held for review.`,
          isCustomerVisible: false,
        });
        await markProcessed(eventId, "Amount mismatch — routed to review.");
        return { handled: true, event, orderNumber: payment.order.orderNumber };
      }

      const { confirmPaidOrder } = await import("@/lib/order-service");
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          providerPaymentId: entity.id,
          method: entity.method ?? "upi",
          upiVpa: entity.vpa ?? null,
          rawPayload: entity as unknown as object,
        },
      });
      await confirmPaidOrder(payment.orderId, {
        note: `Confirmed by Razorpay webhook (${entity.id}).`,
      });
      await markProcessed(eventId);
      return { handled: true, event, orderNumber: payment.order.orderNumber };
    }

    if (event === "payment.failed") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          providerPaymentId: entity.id,
          failureReason:
            entity.error_description ?? entity.error_reason ?? "Payment failed at the gateway.",
          rawPayload: entity as unknown as object,
        },
      });
      await appendTimeline(payment.orderId, {
        type: "STATUS_CHANGED",
        message: `Payment attempt failed: ${entity.error_description ?? "no reason given"}.`,
      });
      await markProcessed(eventId);
      return { handled: true, event, orderNumber: payment.order.orderNumber };
    }

    await markProcessed(eventId, `Ignored event type ${event}.`);
    return { handled: true, event };
  },

  async refund(paymentId: string, amountPaise: number): Promise<PaymentResult> {
    const razorpay = api();
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment?.providerPaymentId) {
      return { ok: false, error: "That payment has no gateway reference to refund." };
    }

    const refundable = payment.amountPaise - payment.refundedPaise;
    if (amountPaise <= 0 || amountPaise > refundable) {
      return { ok: false, error: `Refundable amount is ${refundable / 100} rupees.` };
    }

    try {
      const refund = await razorpay.payments.refund(payment.providerPaymentId, {
        amount: amountPaise,
        speed: "normal",
      });

      const refundedPaise = payment.refundedPaise + amountPaise;
      const fullyRefunded = refundedPaise >= payment.amountPaise;

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundedPaise,
          providerRefundId: refund.id,
          status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
        },
      });

      return {
        ok: true,
        status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
        message: `Razorpay refund ${refund.id} initiated.`,
      };
    } catch (error) {
      console.error("razorpay refund failed", error);
      return { ok: false, error: "The gateway rejected that refund. Check the dashboard." };
    }
  },
};

async function markProcessed(eventId: string, note?: string) {
  await prisma.webhookEvent.update({
    where: { provider_eventId: { provider: "RAZORPAY", eventId } },
    data: { processedAt: new Date(), error: note },
  });
}

type RazorpayWebhookBody = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id: string;
        order_id: string;
        amount: number;
        method?: string;
        vpa?: string;
        error_reason?: string;
        error_description?: string;
      };
    };
  };
};
