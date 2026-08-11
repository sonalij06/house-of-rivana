import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail, sendWhatsApp } from "@/lib/notifications";
import {
  orderCancelledEmail,
  orderDeliveredEmail,
  orderReceivedEmail,
  orderShippedEmail,
  paymentRejectedEmail,
  paymentVerifiedEmail,
  refundIssuedEmail,
  whatsappTemplates,
  type OrderEmailContext,
} from "@/lib/notifications/templates";
import {
  appendTimeline,
  canTransition,
  commitStock,
  recordCouponRedemption,
  releaseHold,
  restock,
} from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { formatDate, formatPaise } from "@/lib/utils";
import type { OrderStatus } from "@/generated/prisma/client";

/**
 * Everything that changes an order's state lives here, so the storefront, the
 * admin actions, the webhook and the cron all take the same path — including the
 * ledger writes and the customer notifications.
 */

export type ServiceResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const NOTIFY_CONTEXT_INCLUDE = {
  items: true,
  shipments: { orderBy: { createdAt: "desc" as const }, take: 1 },
};

async function emailContext(orderId: string): Promise<
  (OrderEmailContext & { phone: string; email: string; orderId: string }) | null
> {
  const [order, settings] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId }, include: NOTIFY_CONTEXT_INCLUDE }),
    getSettings(),
  ]);
  if (!order) return null;

  const address = order.shippingAddress as { fullName?: string } | null;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: address?.fullName ?? "there",
    // Guests need the token to reach their own order.
    orderUrl: `${env.NEXT_PUBLIC_APP_URL}/order/${order.orderNumber}?t=${order.accessToken}`,
    items: order.items.map((item) => ({
      productName: item.productName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      lineTotalPaise: item.lineTotalPaise,
    })),
    subtotalPaise: order.subtotalPaise,
    discountPaise: order.discountPaise,
    shippingPaise: order.shippingPaise,
    grandTotalPaise: order.grandTotalPaise,
    brandName: settings.brandName,
    supportEmail: settings.supportEmail,
    email: order.email,
    phone: order.phone,
  };
}

/** Sent when the order is created, before payment has been verified. */
export async function notifyOrderReceived(orderId: string) {
  const ctx = await emailContext(orderId);
  if (!ctx) return;

  await Promise.all([
    sendEmail({
      to: ctx.email,
      orderId,
      templateName: "order-received",
      template: orderReceivedEmail(ctx),
    }),
    sendWhatsApp({
      to: ctx.phone,
      orderId,
      templateName: "order-received",
      body: whatsappTemplates.orderReceived({
        orderNumber: ctx.orderNumber,
        total: formatPaise(ctx.grandTotalPaise),
        url: ctx.orderUrl,
      }),
    }),
  ]);
}

/**
 * The single gate for "the money is real". Commits stock, records the coupon
 * redemption, stamps paidAt and tells the customer. Idempotent: calling it twice
 * (webhook retry plus an admin click) does nothing the second time.
 */
export async function confirmPaidOrder(
  orderId: string,
  options: { actorId?: string | null; note?: string } = {},
): Promise<ServiceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, orderNumber: true, paidAt: true },
  });
  if (!order) return { ok: false, error: "Order not found." };

  if (order.paidAt && order.status !== "PENDING_PAYMENT") {
    return { ok: true, message: `${order.orderNumber} was already confirmed.` };
  }
  if (!canTransition(order.status, "CONFIRMED")) {
    return {
      ok: false,
      error: `An order that is ${order.status.toLowerCase().replace(/_/g, " ")} cannot be confirmed.`,
    };
  }

  await commitStock(orderId, options.actorId);
  await recordCouponRedemption(orderId);

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "CONFIRMED", paidAt: new Date() },
  });

  await appendTimeline(orderId, {
    type: "PAYMENT_VERIFIED",
    message: options.note ?? "Payment verified and order confirmed.",
    actorId: options.actorId,
  });

  const ctx = await emailContext(orderId);
  if (ctx) {
    await Promise.all([
      sendEmail({
        to: ctx.email,
        orderId,
        templateName: "payment-verified",
        template: paymentVerifiedEmail(ctx),
      }),
      sendWhatsApp({
        to: ctx.phone,
        orderId,
        templateName: "payment-verified",
        body: whatsappTemplates.paymentVerified({
          orderNumber: ctx.orderNumber,
          url: ctx.orderUrl,
        }),
      }),
    ]);
  }

  return { ok: true, message: `${order.orderNumber} confirmed.` };
}

/** Admin rejects a UPI proof: the order goes back to awaiting payment. */
export async function rejectPayment(
  orderId: string,
  reason: string,
  actorId?: string | null,
): Promise<ServiceResult> {
  const payment = await prisma.payment.findFirst({
    where: { orderId, status: "UNDER_REVIEW" },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) {
    return { ok: false, error: "There is no payment awaiting review on this order." };
  }

  const settings = await getSettings();

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", rejectionReason: reason, verifiedById: actorId ?? null },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PENDING_PAYMENT",
        // Give them a fresh window rather than an order they cannot pay for.
        stockHoldExpiresAt: new Date(Date.now() + settings.paymentHoldMinutes * 60_000),
      },
    }),
  ]);

  await appendTimeline(orderId, {
    type: "PAYMENT_REJECTED",
    message: `Payment could not be verified: ${reason}`,
    actorId,
  });

  const ctx = await emailContext(orderId);
  if (ctx) {
    await Promise.all([
      sendEmail({
        to: ctx.email,
        orderId,
        templateName: "payment-rejected",
        template: paymentRejectedEmail({ ...ctx, reason }),
      }),
      sendWhatsApp({
        to: ctx.phone,
        orderId,
        templateName: "payment-rejected",
        body: whatsappTemplates.paymentRejected({
          orderNumber: ctx.orderNumber,
          reason,
          url: ctx.orderUrl,
        }),
      }),
    ]);
  }

  return { ok: true, message: "Payment rejected and the customer notified." };
}

/**
 * Generic guarded transition for the fulfilment statuses. Side effects that need
 * more than a status change (payment, shipping, refunds) have their own function.
 */
export async function advanceOrderStatus(
  orderId: string,
  to: OrderStatus,
  options: { actorId?: string | null; note?: string } = {},
): Promise<ServiceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, orderNumber: true, stockCommitted: true },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === to) return { ok: true, message: "Already in that state." };

  if (!canTransition(order.status, to)) {
    return {
      ok: false,
      error: `Cannot move from ${label(order.status)} to ${label(to)}.`,
    };
  }

  if (to === "CANCELLED") return cancelOrder(orderId, options.note, options.actorId);
  if (to === "CONFIRMED") return confirmPaidOrder(orderId, options);

  const timestamps: Partial<Record<OrderStatus, Record<string, Date>>> = {
    SHIPPED: { shippedAt: new Date() },
    DELIVERED: { deliveredAt: new Date() },
  };

  if (to === "OUT_FOR_DELIVERY") {
    await prisma.shipment.updateMany({
      where: { orderId },
      data: { status: "OUT_FOR_DELIVERY" },
    });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: to, ...(timestamps[to] ?? {}) },
  });

  await appendTimeline(orderId, {
    type: "STATUS_CHANGED",
    message: options.note ?? `Status changed to ${label(to)}.`,
    actorId: options.actorId,
    metadata: { from: order.status, to },
  });

  if (to === "RETURNED") {
    await restock(orderId, "RETURN", options.actorId);
  }

  if (to === "DELIVERED") {
    const ctx = await emailContext(orderId);
    if (ctx) {
      await Promise.all([
        sendEmail({
          to: ctx.email,
          orderId,
          templateName: "order-delivered",
          template: orderDeliveredEmail(ctx),
        }),
        sendWhatsApp({
          to: ctx.phone,
          orderId,
          templateName: "order-delivered",
          body: whatsappTemplates.orderDelivered({
            orderNumber: ctx.orderNumber,
            url: ctx.orderUrl,
          }),
        }),
      ]);
    }
    await prisma.shipment.updateMany({
      where: { orderId },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
  }

  return { ok: true, message: `${order.orderNumber} is now ${label(to)}.` };
}

export async function cancelOrder(
  orderId: string,
  reason?: string,
  actorId?: string | null,
): Promise<ServiceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, orderNumber: true, stockCommitted: true },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "CANCELLED") {
    return { ok: true, message: "Already cancelled." };
  }
  if (!canTransition(order.status, "CANCELLED")) {
    return {
      ok: false,
      error: `A ${label(order.status).toLowerCase()} order cannot be cancelled. Process a return instead.`,
    };
  }

  // Un-sell it: committed stock goes back on the shelf, an untouched hold is
  // simply released.
  if (order.stockCommitted) {
    await restock(orderId, "CANCELLATION", actorId);
  } else {
    await releaseHold(orderId);
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await prisma.payment.updateMany({
    where: {
      orderId,
      status: { in: ["INITIATED", "AWAITING_CONFIRMATION", "UNDER_REVIEW"] },
    },
    data: { status: "EXPIRED" },
  });

  await appendTimeline(orderId, {
    type: "CANCELLED",
    message: reason ? `Order cancelled: ${reason}` : "Order cancelled.",
    actorId,
  });

  const ctx = await emailContext(orderId);
  if (ctx) {
    await Promise.all([
      sendEmail({
        to: ctx.email,
        orderId,
        templateName: "order-cancelled",
        template: orderCancelledEmail({ ...ctx, reason }),
      }),
      sendWhatsApp({
        to: ctx.phone,
        orderId,
        templateName: "order-cancelled",
        body: whatsappTemplates.orderCancelled({ orderNumber: ctx.orderNumber }),
      }),
    ]);
  }

  return { ok: true, message: `${order.orderNumber} cancelled.` };
}

export async function shipOrder(
  orderId: string,
  input: {
    carrier: string;
    awb: string;
    trackingUrl?: string | null;
    estimatedDelivery?: Date | null;
    weightGrams?: number | null;
    actorId?: string | null;
  },
): Promise<ServiceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, orderNumber: true },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (!canTransition(order.status, "SHIPPED")) {
    return {
      ok: false,
      error: `An order that is ${label(order.status).toLowerCase()} cannot be marked shipped yet.`,
    };
  }

  const shipment = await prisma.shipment.create({
    data: {
      orderId,
      carrier: input.carrier.trim(),
      awb: input.awb.trim(),
      trackingUrl: input.trackingUrl?.trim() || null,
      estimatedDelivery: input.estimatedDelivery ?? null,
      weightGrams: input.weightGrams ?? null,
      status: "PICKED_UP",
      shippedAt: new Date(),
      events: {
        create: {
          status: "PICKED_UP",
          description: `Collected by ${input.carrier.trim()}.`,
        },
      },
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "SHIPPED", shippedAt: new Date() },
  });

  await appendTimeline(orderId, {
    type: "SHIPMENT_UPDATED",
    message: `Shipped with ${input.carrier.trim()} · ${input.awb.trim()}`,
    metadata: { shipmentId: shipment.id, awb: input.awb.trim() },
    actorId: input.actorId,
  });

  const ctx = await emailContext(orderId);
  if (ctx) {
    await Promise.all([
      sendEmail({
        to: ctx.email,
        orderId,
        templateName: "order-shipped",
        template: orderShippedEmail({
          ...ctx,
          carrier: input.carrier.trim(),
          awb: input.awb.trim(),
          trackingUrl: input.trackingUrl ?? null,
          estimatedDelivery: input.estimatedDelivery
            ? formatDate(input.estimatedDelivery)
            : null,
        }),
      }),
      sendWhatsApp({
        to: ctx.phone,
        orderId,
        templateName: "order-shipped",
        body: whatsappTemplates.orderShipped({
          orderNumber: ctx.orderNumber,
          carrier: input.carrier.trim(),
          awb: input.awb.trim(),
          url: input.trackingUrl || ctx.orderUrl,
        }),
      }),
    ]);
  }

  return { ok: true, message: `${order.orderNumber} marked shipped.` };
}

export async function recordRefund(
  orderId: string,
  refundPaise: number,
  actorId?: string | null,
): Promise<ServiceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, grandTotalPaise: true, refundedPaise: true, status: true },
  });
  if (!order) return { ok: false, error: "Order not found." };

  const refundedTotal = order.refundedPaise + refundPaise;
  const fully = refundedTotal >= order.grandTotalPaise;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      refundedPaise: refundedTotal,
      ...(fully && canTransition(order.status, "REFUNDED") ? { status: "REFUNDED" } : {}),
    },
  });

  await appendTimeline(orderId, {
    type: "REFUND_ISSUED",
    message: `Refund of ${formatPaise(refundPaise)} recorded.`,
    actorId,
    metadata: { refundPaise, refundedTotal },
  });

  const ctx = await emailContext(orderId);
  if (ctx) {
    await sendEmail({
      to: ctx.email,
      orderId,
      templateName: "refund-issued",
      template: refundIssuedEmail({ ...ctx, refundPaise }),
    });
  }

  return { ok: true, message: `Refund of ${formatPaise(refundPaise)} recorded.` };
}

/**
 * Rebuilds and re-sends one order email. Used by the admin when a message failed
 * or the customer never received it — the body is regenerated from the order, so
 * it always reflects the current state rather than a stale copy.
 */
export async function resendOrderNotification(
  orderId: string,
  template: string,
): Promise<ServiceResult> {
  const ctx = await emailContext(orderId);
  if (!ctx) return { ok: false, error: "Order not found." };

  const shipment = await prisma.shipment.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });

  const build = (): { name: string; email: ReturnType<typeof orderReceivedEmail> } | null => {
    switch (template) {
      case "order-received":
        return { name: template, email: orderReceivedEmail(ctx) };
      case "payment-verified":
        return { name: template, email: paymentVerifiedEmail(ctx) };
      case "order-delivered":
        return { name: template, email: orderDeliveredEmail(ctx) };
      case "order-cancelled":
        return { name: template, email: orderCancelledEmail(ctx) };
      case "order-shipped":
        if (!shipment) return null;
        return {
          name: template,
          email: orderShippedEmail({
            ...ctx,
            carrier: shipment.carrier,
            awb: shipment.awb ?? "—",
            trackingUrl: shipment.trackingUrl,
            estimatedDelivery: shipment.estimatedDelivery
              ? formatDate(shipment.estimatedDelivery)
              : null,
          }),
        };
      default:
        return null;
    }
  };

  const built = build();
  if (!built) {
    return {
      ok: false,
      error: `“${template}” cannot be rebuilt automatically. Trigger it from the order instead.`,
    };
  }

  const result = await sendEmail({
    to: ctx.email,
    orderId,
    templateName: built.name,
    template: built.email,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.skipped
        ? "Email is not configured on this deployment."
        : (result.error ?? "The provider rejected the message."),
    };
  }

  return { ok: true, message: `Re-sent to ${ctx.email}.` };
}

/**
 * Sweeper for abandoned checkouts. Releases the stock reservation and cancels the
 * order so the piece is sellable again, which matters when stock counts are one.
 */
export async function releaseExpiredHolds(now = new Date()) {
  const expired = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      stockCommitted: false,
      stockHoldExpiresAt: { lt: now },
    },
    select: { id: true, orderNumber: true },
    take: 100,
  });

  const released: string[] = [];
  for (const order of expired) {
    try {
      await releaseHold(order.id);
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      await prisma.payment.updateMany({
        where: {
          orderId: order.id,
          status: { in: ["INITIATED", "AWAITING_CONFIRMATION"] },
        },
        data: { status: "EXPIRED" },
      });
      await appendTimeline(order.id, {
        type: "CANCELLED",
        message: "Cancelled automatically — payment was not completed in time.",
      });
      released.push(order.orderNumber);
    } catch (error) {
      console.error(`Failed to release hold on ${order.orderNumber}`, error);
    }
  }

  return { released, scanned: expired.length };
}

function label(status: OrderStatus) {
  return status.toLowerCase().replace(/_/g, " ");
}
