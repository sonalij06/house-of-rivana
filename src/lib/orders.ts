import { prisma, type Prisma } from "@/lib/db";
import { generateAccessToken, generateOrderNumber, safeTokenEqual } from "@/lib/ids";
import { getSettings } from "@/lib/settings";
import type { CartSnapshot } from "@/lib/cart";
import type { OrderStatus, TimelineEntryType } from "@/generated/prisma/client";

export type ShippingAddressSnapshot = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

/**
 * Legal transitions. Anything not listed is rejected, which is what stops a
 * mis-click in the admin from marking an unpaid order as delivered.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAYMENT_UNDER_REVIEW", "CONFIRMED", "CANCELLED"],
  PAYMENT_UNDER_REVIEW: ["CONFIRMED", "PENDING_PAYMENT", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "PACKED", "CANCELLED", "REFUNDED"],
  PROCESSING: ["PACKED", "CANCELLED", "REFUNDED"],
  PACKED: ["SHIPPED", "PROCESSING", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURN_REQUESTED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "SHIPPED", "RETURN_REQUESTED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED"],
  RETURNED: ["REFUNDED"],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return from === to || TRANSITIONS[from]?.includes(to) === true;
}

export function nextStatuses(from: OrderStatus) {
  return TRANSITIONS[from] ?? [];
}

/** Statuses where the customer still owes us money. */
export const UNPAID_STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "PAYMENT_UNDER_REVIEW"];

export async function appendTimeline(
  orderId: string,
  entry: {
    type: TimelineEntryType;
    message: string;
    metadata?: Prisma.InputJsonValue;
    actorId?: string | null;
    isCustomerVisible?: boolean;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return tx.orderTimelineEntry.create({
    data: {
      orderId,
      type: entry.type,
      message: entry.message,
      metadata: entry.metadata,
      actorId: entry.actorId ?? null,
      isCustomerVisible: entry.isCustomerVisible ?? true,
    },
  });
}

/**
 * Order numbers are human-facing and must be unique. Collisions are astronomically
 * unlikely but cheap to retry, and a failure here would lose a sale.
 */
async function reserveOrderNumber() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateOrderNumber();
    const clash = await prisma.order.findUnique({
      where: { orderNumber: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate an order number.");
}

export type CreateOrderInput = {
  snapshot: CartSnapshot;
  userId: string | null;
  email: string;
  phone: string;
  shippingAddress: ShippingAddressSnapshot;
  billingAddress?: ShippingAddressSnapshot | null;
  customerNote?: string | null;
  giftWrap?: boolean;
};

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: string; accessToken: string }
  | { ok: false; error: string };

/**
 * Creates the order and reserves stock for a fixed window. Reservation uses
 * `reservedQty` rather than decrementing `stockQty`, so an abandoned checkout can
 * be swept without inventing inventory; the real decrement happens on payment.
 *
 * The reservation is guarded by a conditional update inside the transaction, so
 * two buyers racing for the last piece cannot both succeed.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const { snapshot } = input;
  if (snapshot.lines.length === 0) {
    return { ok: false, error: "Your bag is empty." };
  }

  const settings = await getSettings();
  const orderNumber = await reserveOrderNumber();
  const accessToken = generateAccessToken();
  const holdExpiresAt = new Date(Date.now() + settings.paymentHoldMinutes * 60_000);

  // Only attach the coupon if the priced snapshot actually honoured it; a stored
  // code that has stopped qualifying must not be recorded as redeemed.
  const appliedCode = snapshot.breakdown.appliedCouponCode;
  const coupon = appliedCode
    ? await prisma.coupon.findUnique({ where: { code: appliedCode } })
    : null;

  try {
    const order = await prisma.$transaction(async (tx) => {
      for (const line of snapshot.lines) {
        // Prisma filters cannot compare two columns, so reservation is done in
        // two steps: increment under a row lock, then assert the post-condition.
        // A concurrent checkout blocks on that lock and re-reads the new value,
        // and any violation rolls the whole transaction back, so no stock leaks.
        const reserved = await tx.productVariant.updateMany({
          where: { id: line.variantId, isActive: true, stockQty: { gte: line.quantity } },
          data: { reservedQty: { increment: line.quantity } },
        });
        if (reserved.count === 0) {
          throw new StockError(`${line.name} (${line.variantLabel}) has just sold out.`);
        }

        const after = await tx.productVariant.findUniqueOrThrow({
          where: { id: line.variantId },
          select: { stockQty: true, reservedQty: true },
        });
        if (after.reservedQty > after.stockQty) {
          throw new StockError(
            `${line.name} (${line.variantLabel}) was taken while you were checking out.`,
          );
        }
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          accessToken,
          userId: input.userId,
          email: input.email,
          phone: input.phone,
          status: "PENDING_PAYMENT",
          subtotalPaise: snapshot.breakdown.subtotalPaise,
          discountPaise: snapshot.breakdown.discountPaise,
          shippingPaise: snapshot.breakdown.shippingPaise,
          taxPaise: snapshot.breakdown.taxPaise,
          grandTotalPaise: snapshot.breakdown.grandTotalPaise,
          couponId: coupon?.id ?? null,
          couponCode: coupon?.code ?? null,
          shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
          billingAddress: (input.billingAddress ??
            null) as unknown as Prisma.InputJsonValue,
          customerNote: input.customerNote?.trim() || null,
          giftWrap: input.giftWrap ?? false,
          stockHoldExpiresAt: holdExpiresAt,
          items: {
            create: snapshot.lines.map((line) => ({
              variantId: line.variantId,
              productId: line.productId,
              productName: line.name,
              productSlug: line.slug,
              variantLabel: line.variantLabel,
              sku: line.sku,
              imageUrl: line.imageUrl,
              unitPricePaise: line.unitPricePaise,
              quantity: line.quantity,
              lineTotalPaise: line.lineTotalPaise,
            })),
          },
        },
      });

      await appendTimeline(
        created.id,
        {
          type: "ORDER_PLACED",
          message: `Order ${orderNumber} placed. Stock held until ${holdExpiresAt.toISOString()}.`,
          metadata: { holdMinutes: settings.paymentHoldMinutes },
        },
        tx,
      );

      return created;
    });

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      accessToken: order.accessToken,
    };
  } catch (error) {
    if (error instanceof StockError) return { ok: false, error: error.message };
    console.error("createOrder failed", error);
    return {
      ok: false,
      error: "We could not place that order. Nothing has been charged — please try again.",
    };
  }
}

class StockError extends Error {}

/**
 * Turns a reservation into a real decrement and writes the ledger. Called once,
 * when payment is confirmed; idempotent via the `stockCommitted` flag.
 */
export async function commitStock(orderId: string, actorId?: string | null) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    if (order.stockCommitted) return;

    for (const item of order.items) {
      if (!item.variantId) continue;
      const variant = await tx.productVariant.update({
        where: { id: item.variantId },
        data: {
          stockQty: { decrement: item.quantity },
          reservedQty: { decrement: item.quantity },
        },
      });
      await tx.inventoryMovement.create({
        data: {
          variantId: item.variantId,
          delta: -item.quantity,
          reason: "ORDER",
          balanceAfter: variant.stockQty,
          orderId,
          note: `Order ${order.orderNumber}`,
          actorId: actorId ?? null,
        },
      });
      if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { soldCount: { increment: item.quantity } },
        });
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: { stockCommitted: true, stockHoldExpiresAt: null },
    });
  });
}

/**
 * Releases a reservation without touching real stock. Used by the hold sweeper
 * and by cancellation of an unpaid order.
 */
export async function releaseHold(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    if (order.stockCommitted || order.stockHoldExpiresAt == null) return;

    for (const item of order.items) {
      if (!item.variantId) continue;
      await tx.productVariant.update({
        where: { id: item.variantId },
        // Clamp at zero: a manual stock edit could otherwise drive this negative.
        data: { reservedQty: { decrement: item.quantity } },
      });
      await tx.productVariant.updateMany({
        where: { id: item.variantId, reservedQty: { lt: 0 } },
        data: { reservedQty: 0 },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: { stockHoldExpiresAt: null },
    });
  });
}

/** Puts committed stock back on the shelf after a cancellation or return. */
export async function restock(
  orderId: string,
  reason: "CANCELLATION" | "RETURN",
  actorId?: string | null,
) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order.stockCommitted) return;

    for (const item of order.items) {
      if (!item.variantId) continue;
      const variant = await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockQty: { increment: item.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          variantId: item.variantId,
          delta: item.quantity,
          reason,
          balanceAfter: variant.stockQty,
          orderId,
          note: `${reason === "RETURN" ? "Return" : "Cancellation"} of ${order.orderNumber}`,
          actorId: actorId ?? null,
        },
      });
      if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { soldCount: { decrement: item.quantity } },
        });
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: { stockCommitted: false },
    });
  });
}

/** Records the coupon redemption once, at the point the order is confirmed. */
export async function recordCouponRedemption(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      couponId: true,
      userId: true,
      discountPaise: true,
      redemption: { select: { id: true } },
    },
  });
  if (!order.couponId || order.redemption) return;

  await prisma.$transaction([
    prisma.couponRedemption.create({
      data: {
        couponId: order.couponId,
        orderId: order.id,
        userId: order.userId,
        discountPaise: order.discountPaise,
      },
    }),
    prisma.coupon.update({
      where: { id: order.couponId },
      data: { usedCount: { increment: 1 } },
    }),
  ]);
}

export const ORDER_DETAIL_INCLUDE = {
  items: true,
  payments: { orderBy: { createdAt: "desc" as const } },
  shipments: {
    orderBy: { createdAt: "desc" as const },
    include: { events: { orderBy: { occurredAt: "desc" as const } } },
  },
  timeline: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{
  include: typeof ORDER_DETAIL_INCLUDE;
}>;

/**
 * Guests reach their order with a signed token in the URL; account holders are
 * matched on userId. Staff can see anything.
 */
export async function getOrderForViewer(
  orderNumber: string,
  viewer: { userId?: string | null; isStaff?: boolean; token?: string | null },
): Promise<OrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: ORDER_DETAIL_INCLUDE,
  });
  if (!order) return null;

  if (viewer.isStaff) return order;
  if (viewer.userId && order.userId === viewer.userId) return order;
  if (viewer.token && safeTokenEqual(order.accessToken, viewer.token)) return order;
  return null;
}
