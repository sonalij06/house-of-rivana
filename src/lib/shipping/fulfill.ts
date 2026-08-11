import { prisma } from "@/lib/db";
import { features } from "@/lib/env";
import { canTransition } from "@/lib/orders";
import { advanceOrderStatus, shipOrder } from "@/lib/order-service";
import { createForwardShipment } from "@/lib/shipping/shiprocket";
import type { OrderStatus } from "@/generated/prisma/client";

export type FulfillResult =
  | { ok: true; message: string; awb: string; etd: Date | null }
  | { ok: false; error: string };

/**
 * Creates the Shiprocket forward shipment (order + AWB + pickup), then marks the
 * local order shipped through the same path as manual dispatch.
 */
export async function fulfillOrderViaShiprocket(
  orderId: string,
  actorId?: string | null,
): Promise<FulfillResult> {
  if (!features.shiprocket) {
    return {
      ok: false,
      error: "Shiprocket is not configured. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.",
    };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      shipments: { select: { id: true }, take: 1 },
    },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.shipments.length) {
    return { ok: false, error: "This order already has a shipment." };
  }

  // shipOrder only accepts PACKED → SHIPPED; walk the order forward if needed.
  const status = order.status as OrderStatus;
  if (status === "CONFIRMED" || status === "PROCESSING") {
    const packed = await advanceOrderStatus(orderId, "PACKED", {
      actorId,
      note: "Packed automatically before Shiprocket dispatch.",
    });
    if (!packed.ok) return { ok: false, error: packed.error };
  } else if (!canTransition(status, "SHIPPED") && status !== "PACKED") {
    return {
      ok: false,
      error: `Cannot dispatch a ${status.toLowerCase().replace(/_/g, " ")} order via Shiprocket.`,
    };
  }

  const address = order.shippingAddress as {
    fullName: string;
    phone?: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };

  try {
    const created = await createForwardShipment({
      orderNumber: order.orderNumber,
      orderDate: order.placedAt,
      email: order.email,
      phone: order.phone || address.phone || "",
      address,
      items: order.items.map((item) => ({
        name: item.productName,
        sku: item.sku,
        units: item.quantity,
        sellingPriceRupees: Math.max(1, Math.round(item.unitPricePaise / 100)),
      })),
      subTotalRupees: Math.max(
        1,
        Math.round((order.subtotalPaise - order.discountPaise) / 100),
      ),
      shippingChargesRupees: Math.round(order.shippingPaise / 100),
      weightGrams:
        order.items.reduce((sum, item) => sum + item.quantity * 40, 0) || 200,
    });

    const shipped = await shipOrder(orderId, {
      carrier: created.courierName,
      awb: created.awb,
      trackingUrl: created.trackingUrl,
      estimatedDelivery: created.etd,
      weightGrams: order.items.reduce((sum, item) => sum + item.quantity * 40, 0) || 200,
      actorId,
    });
    if (!shipped.ok) return { ok: false, error: shipped.error };

    await prisma.shipment.updateMany({
      where: { orderId, awb: created.awb },
      data: {
        provider: "SHIPROCKET",
        externalOrderId: String(created.shiprocketOrderId),
        externalShipmentId: String(created.shipmentId),
        shippingCostPaise: created.shippingCostPaise,
      },
    });

    return {
      ok: true,
      message: `${order.orderNumber} dispatched via Shiprocket · ${created.awb}`,
      awb: created.awb,
      etd: created.etd,
    };
  } catch (error) {
    console.error("shiprocket fulfill failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Shiprocket dispatch failed.",
    };
  }
}
