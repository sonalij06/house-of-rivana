"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { features } from "@/lib/env";
import { assertStaff, recordAudit } from "@/lib/session";
import { fulfillOrderViaShiprocket } from "@/lib/shipping/fulfill";
import { checkServiceability } from "@/lib/shipping/shiprocket";
import { syncShipmentFromShiprocket } from "@/lib/shipping/sync";
import { formatDate } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/cart";

/** Public PIN-code ETA for checkout / product pages. */
export async function estimateDelivery(input: {
  postalCode: string;
}): Promise<
  ActionResult<{
    etdLabel: string | null;
    etdIso: string | null;
    courierName: string | null;
    rateRupees: number | null;
    estimatedDays: number | null;
  }>
> {
  if (!features.shiprocket) {
    return { ok: false, error: "Delivery estimates are unavailable right now." };
  }

  const postalCode = input.postalCode.replace(/\D/g, "").slice(0, 6);
  if (postalCode.length !== 6) {
    return { ok: false, error: "Enter a valid 6-digit PIN code." };
  }

  try {
    const options = await checkServiceability({
      deliveryPincode: postalCode,
      weightKg: 0.2,
      cod: false,
    });
    const best = options[0];
    if (!best) {
      return { ok: false, error: "We do not currently ship to that PIN code." };
    }

    return {
      ok: true,
      data: {
        etdLabel: best.etdDate
          ? formatDate(best.etdDate)
          : best.etd ||
            (best.estimatedDays != null
              ? `About ${best.estimatedDays} day${best.estimatedDays === 1 ? "" : "s"}`
              : null),
        etdIso: best.etdDate?.toISOString() ?? null,
        courierName: best.courierName,
        rateRupees: best.rate,
        estimatedDays: best.estimatedDays,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not check delivery.",
    };
  }
}

export async function shipOrderViaShiprocket(
  orderId: string,
): Promise<ActionResult<{ message: string }>> {
  const actor = await assertStaff();
  const parsed = z.string().min(1).safeParse(orderId);
  if (!parsed.success) return { ok: false, error: "Missing order." };

  const result = await fulfillOrderViaShiprocket(parsed.data, actor.id);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    actor,
    action: "order.ship.shiprocket",
    entity: "Order",
    entityId: parsed.data,
    after: { awb: result.awb, etd: result.etd?.toISOString() ?? null },
  });

  revalidatePath(`/admin/orders/${parsed.data}`);
  revalidatePath("/admin/shipments");
  revalidatePath("/admin/orders");
  return { ok: true, data: { message: result.message } };
}

export async function refreshShipmentTracking(
  shipmentId: string,
): Promise<ActionResult<{ message: string }>> {
  await assertStaff();
  const parsed = z.string().min(1).safeParse(shipmentId);
  if (!parsed.success) return { ok: false, error: "Missing shipment." };

  try {
    const result = await syncShipmentFromShiprocket(parsed.data);
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath("/admin/orders");
    revalidatePath("/admin/shipments");
    return {
      ok: true,
      data: {
        message: result.updated
          ? `Tracking updated · ${result.status.replace(/_/g, " ").toLowerCase()}`
          : "Already up to date with Shiprocket.",
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Tracking sync failed.",
    };
  }
}
