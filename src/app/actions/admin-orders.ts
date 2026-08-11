"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertStaff, recordAudit } from "@/lib/session";
import {
  advanceOrderStatus,
  cancelOrder,
  confirmPaidOrder,
  recordRefund,
  rejectPayment,
  shipOrder,
} from "@/lib/order-service";
import { appendTimeline } from "@/lib/orders";
import { getProvider } from "@/lib/payments";
import { signedProofUrl } from "@/lib/storage";
import type { ActionResult } from "@/app/actions/cart";
import { failMessage, failWrite, failZod } from "@/lib/action-errors";
import type { OrderStatus } from "@/generated/prisma/client";

const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_UNDER_REVIEW",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "RETURN_REQUESTED",
  "RETURNED",
] as const;

function revalidateOrder(orderId: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/account/orders");
}

/** Approves a manual UPI payment after the operator has matched the UTR. */
export async function verifyPayment(input: {
  paymentId: string;
  note?: string;
}): Promise<ActionResult<{ message: string }>> {
  const actor = await assertStaff();

  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    include: { order: { select: { id: true, orderNumber: true } } },
  });
  if (!payment) return { ok: false, error: "That payment no longer exists." };
  if (payment.status === "PAID") {
    return { ok: true, data: { message: "Already verified." } };
  }

  const provider = getProvider(payment.provider === "RAZORPAY" ? "razorpay" : "manual_upi");
  if (!provider.verifyProof) {
    return { ok: false, error: "This provider confirms payments automatically." };
  }

  const result = await provider.verifyProof({
    paymentId: payment.id,
    verifiedById: actor.id,
    note: input.note,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const confirmed = await confirmPaidOrder(payment.orderId, {
    actorId: actor.id,
    note: input.note
      ? `Payment verified by ${actor.name}: ${input.note}`
      : `Payment verified by ${actor.name}.`,
  });
  if (!confirmed.ok) return { ok: false, error: confirmed.error };

  await recordAudit({
    actor,
    action: "payment.verify",
    entity: "Payment",
    entityId: payment.id,
    after: { orderNumber: payment.order.orderNumber, utr: payment.upiUtr },
  });

  revalidateOrder(payment.orderId);
  revalidatePath("/admin/payments/review");
  return { ok: true, data: { message: confirmed.message } };
}

export async function declinePayment(input: {
  paymentId: string;
  reason: string;
}): Promise<ActionResult<{ message: string }>> {
  const actor = await assertStaff();

  const reason = input.reason.trim();
  if (reason.length < 5) {
    return {
      ok: false,
      error: "Give the customer a reason — they will see it in the email.",
    };
  }

  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: { id: true, orderId: true },
  });
  if (!payment) return { ok: false, error: "That payment no longer exists." };

  const result = await rejectPayment(payment.orderId, reason, actor.id);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    actor,
    action: "payment.reject",
    entity: "Payment",
    entityId: payment.id,
    after: { reason },
  });

  revalidateOrder(payment.orderId);
  revalidatePath("/admin/payments/review");
  return { ok: true, data: { message: result.message } };
}

/** Short-lived signed URL so proofs are never public. */
export async function getProofUrl(
  paymentId: string,
): Promise<ActionResult<{ url: string }>> {
  await assertStaff();

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { proofPath: true },
  });
  if (!payment?.proofPath) {
    return { ok: false, error: "No screenshot was attached to this payment." };
  }

  const url = await signedProofUrl(payment.proofPath, 300);
  if (!url) {
    return { ok: false, error: "File storage is not configured on this deployment." };
  }
  return { ok: true, data: { url } };
}

export async function changeOrderStatus(input: {
  orderId: string;
  status: string;
  note?: string;
}): Promise<ActionResult<{ message: string }>> {
  const actor = await assertStaff();

  const parsed = z.enum(ORDER_STATUSES).safeParse(input.status);
  if (!parsed.success) return { ok: false, error: "That is not a valid status." };

  const result = await advanceOrderStatus(input.orderId, parsed.data as OrderStatus, {
    actorId: actor.id,
    note: input.note,
  });
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    actor,
    action: "order.status",
    entity: "Order",
    entityId: input.orderId,
    after: { status: parsed.data, note: input.note },
  });

  revalidateOrder(input.orderId);
  return { ok: true, data: { message: result.message } };
}

const shipmentSchema = z.object({
  orderId: z.string().min(1),
  carrier: z.string().trim().min(2, "Which carrier is taking it?").max(60),
  awb: z.string().trim().min(4, "Enter the tracking number.").max(60),
  trackingUrl: z.string().trim().url("That tracking link is not a valid URL.").or(z.literal("")),
  estimatedDelivery: z.string().trim().optional(),
  weightGrams: z.number().min(0).max(100_000).optional(),
});

export async function createShipment(
  input: unknown,
): Promise<ActionResult<{ message: string }>> {
  const actor = await assertStaff();

  const parsed = shipmentSchema.safeParse(input);
  if (!parsed.success) return failZod(parsed.error);
  const data = parsed.data;

  try {
    const result = await shipOrder(data.orderId, {
      carrier: data.carrier,
      awb: data.awb,
      trackingUrl: data.trackingUrl || null,
      estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
      weightGrams: data.weightGrams ?? null,
      actorId: actor.id,
    });
    if (!result.ok) return failMessage(result.error);

    await recordAudit({
      actor,
      action: "order.ship",
      entity: "Order",
      entityId: data.orderId,
      after: { carrier: data.carrier, awb: data.awb },
    });

    revalidateOrder(data.orderId);
    revalidatePath("/admin/shipments");
    return { ok: true, data: { message: result.message } };
  } catch (err) {
    return failWrite(err);
  }
}

export async function addShipmentEvent(input: {
  shipmentId: string;
  status: string;
  description: string;
  location?: string;
}): Promise<ActionResult> {
  const actor = await assertStaff();

  const statusSchema = z.enum([
    "PENDING",
    "LABEL_CREATED",
    "PICKED_UP",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "FAILED_ATTEMPT",
    "RETURNED_TO_ORIGIN",
    "CANCELLED",
  ]);
  const parsed = statusSchema.safeParse(input.status);
  if (!parsed.success) return { ok: false, error: "Unknown shipment status." };
  if (input.description.trim().length < 3) {
    return { ok: false, error: "Describe what happened." };
  }

  const shipment = await prisma.shipment.update({
    where: { id: input.shipmentId },
    data: {
      status: parsed.data,
      ...(parsed.data === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      events: {
        create: {
          status: parsed.data,
          description: input.description.trim(),
          location: input.location?.trim() || null,
        },
      },
    },
    select: { orderId: true },
  });

  await appendTimeline(shipment.orderId, {
    type: "SHIPMENT_UPDATED",
    message: input.description.trim(),
    actorId: actor.id,
  });

  // Delivery is the terminal happy path; move the order with it.
  if (parsed.data === "DELIVERED") {
    await advanceOrderStatus(shipment.orderId, "DELIVERED", { actorId: actor.id });
  }

  revalidateOrder(shipment.orderId);
  revalidatePath("/admin/shipments");
  return { ok: true };
}

export async function refundOrder(input: {
  orderId: string;
  amountRupees: number;
  viaGateway: boolean;
}): Promise<ActionResult<{ message: string }>> {
  const actor = await assertStaff();

  const amountPaise = Math.round(input.amountRupees * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    return { ok: false, error: "Enter the amount to refund." };
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      grandTotalPaise: true,
      refundedPaise: true,
      payments: {
        where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, provider: true },
      },
    },
  });
  if (!order) return { ok: false, error: "Order not found." };

  const remaining = order.grandTotalPaise - order.refundedPaise;
  if (amountPaise > remaining) {
    return { ok: false, error: `At most ${remaining / 100} rupees can still be refunded.` };
  }

  // Razorpay can push the money back; manual UPI is refunded by hand and only
  // recorded here.
  if (input.viaGateway) {
    const payment = order.payments[0];
    if (!payment || payment.provider !== "RAZORPAY") {
      return {
        ok: false,
        error: "There is no gateway payment on this order. Refund by UPI and record it here.",
      };
    }
    const provider = getProvider("razorpay");
    const result = await provider.refund?.(payment.id, amountPaise);
    if (!result?.ok) {
      return { ok: false, error: result?.error ?? "The gateway refused that refund." };
    }
  }

  const recorded = await recordRefund(input.orderId, amountPaise, actor.id);
  if (!recorded.ok) return { ok: false, error: recorded.error };

  await recordAudit({
    actor,
    action: "order.refund",
    entity: "Order",
    entityId: input.orderId,
    after: { amountPaise, viaGateway: input.viaGateway },
  });

  revalidateOrder(input.orderId);
  return { ok: true, data: { message: recorded.message } };
}

export async function cancelOrderAsStaff(input: {
  orderId: string;
  reason: string;
}): Promise<ActionResult<{ message: string }>> {
  const actor = await assertStaff();

  const result = await cancelOrder(input.orderId, input.reason.trim() || undefined, actor.id);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    actor,
    action: "order.cancel",
    entity: "Order",
    entityId: input.orderId,
    after: { reason: input.reason },
  });

  revalidateOrder(input.orderId);
  return { ok: true, data: { message: result.message } };
}

export async function addOrderNote(input: {
  orderId: string;
  note: string;
  customerVisible: boolean;
}): Promise<ActionResult> {
  const actor = await assertStaff();

  const note = input.note.trim();
  if (note.length < 2) return { ok: false, error: "The note is empty." };

  await appendTimeline(input.orderId, {
    type: "NOTE_ADDED",
    message: note,
    actorId: actor.id,
    isCustomerVisible: input.customerVisible,
  });

  revalidateOrder(input.orderId);
  return { ok: true };
}
