import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env, features } from "@/lib/env";
import { applyWebhookTracking } from "@/lib/shipping/sync";

export const dynamic = "force-dynamic";

/**
 * Shiprocket tracking webhook.
 *
 * Configure in Shiprocket → Settings → API → Webhooks:
 *   URL:   {APP_URL}/api/webhooks/fulfillment
 *   Token: value of SHIPROCKET_WEBHOOK_TOKEN (sent as x-api-key)
 *
 * The path deliberately avoids the word "shiprocket" — their docs reject those URLs.
 */
export async function POST(request: Request) {
  if (!features.shiprocket) {
    return NextResponse.json({ error: "Shipping provider inactive" }, { status: 503 });
  }

  const apiKey = request.headers.get("x-api-key");
  if (
    env.SHIPROCKET_WEBHOOK_TOKEN &&
    apiKey !== env.SHIPROCKET_WEBHOOK_TOKEN
  ) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const rawBody = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const awb = String(payload.awb ?? "").trim();
  if (!awb) {
    return NextResponse.json({ received: true, handled: false, reason: "no awb" });
  }

  const eventId = [
    awb,
    String(payload.current_status_id ?? payload.shipment_status_id ?? ""),
    String(payload.current_timestamp ?? ""),
  ].join(":");

  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "SHIPROCKET", eventId } },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ received: true, handled: true, duplicate: true });
  }

  const scans = Array.isArray(payload.scans)
    ? (payload.scans as Array<Record<string, unknown>>).map((scan) => ({
        date: scan.date ? String(scan.date) : undefined,
        activity: scan.activity ? String(scan.activity) : undefined,
        location: scan.location ? String(scan.location) : undefined,
        statusLabel: scan["sr-status-label"]
          ? String(scan["sr-status-label"])
          : scan.status
            ? String(scan.status)
            : undefined,
      }))
    : [];

  try {
    const result = await applyWebhookTracking({
      awb,
      courierName: payload.courier_name ? String(payload.courier_name) : null,
      currentStatus: payload.current_status
        ? String(payload.current_status)
        : payload.shipment_status
          ? String(payload.shipment_status)
          : null,
      currentStatusId:
        typeof payload.current_status_id === "number"
          ? payload.current_status_id
          : typeof payload.shipment_status_id === "number"
            ? payload.shipment_status_id
            : null,
      etd: payload.etd ? String(payload.etd) : null,
      scans,
    });

    await prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider: "SHIPROCKET", eventId } },
      create: {
        provider: "SHIPROCKET",
        eventId,
        eventType: String(payload.current_status ?? "tracking"),
        payload: payload as object,
        signatureOk: Boolean(env.SHIPROCKET_WEBHOOK_TOKEN),
        processedAt: new Date(),
        error: result.ok ? null : result.error,
      },
      update: {
        processedAt: new Date(),
        error: result.ok ? null : result.error,
        payload: payload as object,
      },
    });

    return NextResponse.json({
      received: true,
      handled: result.ok,
      updated: result.ok ? result.updated : false,
      reason: result.ok ? undefined : result.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("fulfillment webhook failed", error);
    await prisma.webhookEvent
      .create({
        data: {
          provider: "SHIPROCKET",
          eventId: `error:${Date.now()}`,
          eventType: "unhandled_error",
          payload: { rawBody: rawBody.slice(0, 4000) },
          error: message,
        },
      })
      .catch(() => undefined);

    return NextResponse.json({ received: true, error: message }, { status: 500 });
  }
}
