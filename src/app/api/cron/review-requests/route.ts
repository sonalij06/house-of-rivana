import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/notifications";
import { reviewRequestEmail } from "@/lib/notifications/templates";

export const dynamic = "force-dynamic";

/**
 * Daily cron: email customers ~14 days after delivery asking for a review.
 * Skips orders that already received a review-request notification.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const settings = await getSettings();
  const now = Date.now();
  const windowEnd = new Date(now - 13 * 24 * 60 * 60 * 1000);
  const windowStart = new Date(now - 16 * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      deliveredAt: { gte: windowStart, lte: windowEnd },
      email: { not: "" },
    },
    include: {
      items: {
        where: { productId: { not: null } },
        orderBy: { lineTotalPaise: "desc" },
      },
      notifications: {
        where: { template: "review-request" },
        select: { id: true },
        take: 1,
      },
    },
    take: 40,
  });

  let sent = 0;
  let skipped = 0;

  for (const order of orders) {
    if (order.notifications.length > 0) {
      skipped += 1;
      continue;
    }
    const item = order.items[0];
    if (!item?.productSlug) {
      skipped += 1;
      continue;
    }

    const address = order.shippingAddress as { fullName?: string } | null;
    const customerName = address?.fullName?.trim() || "there";
    const productUrl = `${env.NEXT_PUBLIC_APP_URL}/account/reviews?product=${item.productSlug}`;
    const orderUrl = `${env.NEXT_PUBLIC_APP_URL}/order/${order.orderNumber}?t=${order.accessToken}`;

    const template = reviewRequestEmail({
      orderNumber: order.orderNumber,
      customerName,
      orderUrl,
      items: order.items.map((i) => ({
        productName: i.productName,
        variantLabel: i.variantLabel,
        quantity: i.quantity,
        lineTotalPaise: i.lineTotalPaise,
      })),
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      shippingPaise: order.shippingPaise,
      grandTotalPaise: order.grandTotalPaise,
      brandName: settings.brandName,
      supportEmail: settings.supportEmail,
      productName: item.productName,
      productUrl,
    });

    const result = await sendEmail({
      to: order.email,
      template,
      templateName: "review-request",
      orderId: order.id,
    });

    if (result.ok || result.skipped) sent += 1;
  }

  return NextResponse.json({
    ok: true,
    candidates: orders.length,
    sent,
    skipped,
    at: new Date().toISOString(),
  });
}
