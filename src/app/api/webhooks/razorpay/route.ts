import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { razorpayProvider } from "@/lib/payments/razorpay";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook. The raw body is needed byte-for-byte for the HMAC, so we read
 * text and never touch request.json().
 *
 * We answer 200 on anything we have deliberately handled or ignored, and only
 * 4xx/5xx when a retry could actually help — a webhook that keeps failing gets
 * disabled by the gateway.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  try {
    const result = await razorpayProvider.handleWebhook!(rawBody, signature);

    if (!result.handled) {
      const isAuthFailure =
        result.reason?.includes("Signature") || result.reason?.includes("signature");
      return NextResponse.json(
        { received: true, handled: false, reason: result.reason },
        { status: isAuthFailure ? 400 : 200 },
      );
    }

    return NextResponse.json({
      received: true,
      handled: true,
      duplicate: result.duplicate ?? false,
      orderNumber: result.orderNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("razorpay webhook failed", error);

    // Record the failure so it is visible in admin, then ask for a retry.
    await prisma.webhookEvent
      .create({
        data: {
          provider: "RAZORPAY",
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
