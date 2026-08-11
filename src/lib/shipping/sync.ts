import { prisma } from "@/lib/db";
import { appendTimeline } from "@/lib/orders";
import { advanceOrderStatus } from "@/lib/order-service";
import {
  mapShiprocketStatus,
  parseShiprocketDate,
  trackByAwb,
  trackingUrlForAwb,
  type TrackingScan,
} from "@/lib/shipping/shiprocket";
import type { ShipmentStatus } from "@/generated/prisma/client";

export type SyncResult =
  | { ok: true; updated: boolean; status: ShipmentStatus }
  | { ok: false; error: string };

/**
 * Pulls live tracking for one shipment (by AWB) and appends any new events.
 * Also advances the parent order when the parcel is out for delivery / delivered.
 */
export async function syncShipmentFromShiprocket(
  shipmentId: string,
): Promise<SyncResult> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      awb: true,
      orderId: true,
      status: true,
      estimatedDelivery: true,
      trackingUrl: true,
      carrier: true,
      events: { select: { description: true, occurredAt: true } },
    },
  });
  if (!shipment?.awb) return { ok: false, error: "Shipment has no AWB." };

  const snapshot = await trackByAwb(shipment.awb);
  if (!snapshot) {
    return { ok: true, updated: false, status: shipment.status };
  }

  return applyTrackingSnapshot(shipment, {
    status: snapshot.status,
    carrier: snapshot.courierName,
    etd: snapshot.etd,
    trackingUrl: snapshot.trackingUrl,
    scans: snapshot.scans,
    currentStatus: snapshot.currentStatus,
  });
}

/** Used by the webhook — we already have the payload, no need to call track. */
export async function applyWebhookTracking(input: {
  awb: string;
  courierName?: string | null;
  currentStatus?: string | null;
  currentStatusId?: number | null;
  etd?: string | null;
  scans?: Array<{
    date?: string;
    activity?: string;
    location?: string;
    statusLabel?: string;
  }>;
}): Promise<SyncResult> {
  const shipment = await prisma.shipment.findFirst({
    where: { awb: input.awb },
    select: {
      id: true,
      awb: true,
      orderId: true,
      status: true,
      estimatedDelivery: true,
      trackingUrl: true,
      carrier: true,
      events: { select: { description: true, occurredAt: true } },
    },
  });
  if (!shipment) return { ok: false, error: `No local shipment for AWB ${input.awb}.` };

  const scans: TrackingScan[] = (input.scans ?? []).map((scan) => ({
    occurredAt: parseShiprocketDate(scan.date) ?? new Date(),
    activity: scan.activity || "Update",
    location: scan.location || null,
    statusLabel: scan.statusLabel || null,
  }));

  return applyTrackingSnapshot(shipment, {
    status: mapShiprocketStatus(input.currentStatus, input.currentStatusId),
    carrier: input.courierName,
    etd: parseShiprocketDate(input.etd),
    trackingUrl: trackingUrlForAwb(input.awb),
    scans,
    currentStatus: input.currentStatus ?? null,
  });
}

async function applyTrackingSnapshot(
  shipment: {
    id: string;
    orderId: string;
    status: ShipmentStatus;
    estimatedDelivery: Date | null;
    trackingUrl: string | null;
    carrier: string;
    events: { description: string; occurredAt: Date }[];
  },
  update: {
    status: ShipmentStatus;
    carrier?: string | null;
    etd: Date | null;
    trackingUrl: string;
    scans: TrackingScan[];
    currentStatus: string | null;
  },
): Promise<SyncResult> {
  const existingKeys = new Set(
    shipment.events.map(
      (event) => `${event.description}|${event.occurredAt.toISOString()}`,
    ),
  );

  const newScans = update.scans.filter((scan) => {
    const key = `${scan.activity}|${scan.occurredAt.toISOString()}`;
    return !existingKeys.has(key);
  });

  const statusChanged = update.status !== shipment.status;
  const etdChanged =
    update.etd &&
    (!shipment.estimatedDelivery ||
      update.etd.getTime() !== shipment.estimatedDelivery.getTime());

  if (!statusChanged && !etdChanged && newScans.length === 0) {
    return { ok: true, updated: false, status: shipment.status };
  }

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: update.status,
      carrier: update.carrier?.trim() || shipment.carrier,
      trackingUrl: update.trackingUrl || shipment.trackingUrl,
      estimatedDelivery: update.etd ?? shipment.estimatedDelivery,
      ...(update.status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      events: {
        create: newScans.map((scan) => ({
          status: mapShiprocketStatus(scan.statusLabel ?? scan.activity),
          description: scan.activity,
          location: scan.location,
          occurredAt: scan.occurredAt,
        })),
      },
    },
  });

  if (statusChanged || newScans.length > 0) {
    const message =
      newScans.at(-1)?.activity ||
      update.currentStatus ||
      `Shipment is now ${update.status.replace(/_/g, " ").toLowerCase()}.`;
    await appendTimeline(shipment.orderId, {
      type: "SHIPMENT_UPDATED",
      message,
      metadata: { source: "shiprocket", status: update.status },
    });
  }

  if (update.status === "OUT_FOR_DELIVERY") {
    await advanceOrderStatus(shipment.orderId, "OUT_FOR_DELIVERY").catch(() => undefined);
  }
  if (update.status === "DELIVERED") {
    await advanceOrderStatus(shipment.orderId, "DELIVERED").catch(() => undefined);
  }

  return { ok: true, updated: true, status: update.status };
}

/** Cron helper — sync every open Shiprocket (or any AWB) shipment. */
export async function syncOpenShipments(limit = 40) {
  const open = await prisma.shipment.findMany({
    where: {
      awb: { not: null },
      status: {
        notIn: ["DELIVERED", "CANCELLED", "RETURNED_TO_ORIGIN"],
      },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let updated = 0;
  const errors: string[] = [];
  for (const row of open) {
    try {
      const result = await syncShipmentFromShiprocket(row.id);
      if (result.ok && result.updated) updated += 1;
      if (!result.ok) errors.push(result.error);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { scanned: open.length, updated, errors };
}
