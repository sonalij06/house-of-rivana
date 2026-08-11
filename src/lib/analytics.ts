import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { OrderStatus } from "@/generated/prisma/client";

/**
 * Dashboard aggregates. Revenue counts only orders that were actually paid, so
 * abandoned carts and rejected UPI proofs never inflate the numbers.
 */

const PAID_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "RETURN_REQUESTED",
];

export type DashboardRange = 7 | 30 | 90 | 365;

export async function getDashboardMetrics(days: DashboardRange = 30) {
  const now = new Date();
  const start = new Date(now.getTime() - days * 86_400_000);
  const previousStart = new Date(start.getTime() - days * 86_400_000);

  const paidWhere = { status: { in: PAID_STATUSES } };

  const [current, previous, orderCount, statusGroups, pendingReview, settings] =
    await Promise.all([
      prisma.order.aggregate({
        where: { ...paidWhere, paidAt: { gte: start } },
        _sum: { grandTotalPaise: true, refundedPaise: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { ...paidWhere, paidAt: { gte: previousStart, lt: start } },
        _sum: { grandTotalPaise: true },
        _count: true,
      }),
      prisma.order.count({ where: { placedAt: { gte: start } } }),
      prisma.order.groupBy({
        by: ["status"],
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
      prisma.payment.count({ where: { status: "UNDER_REVIEW" } }),
      getSettings(),
    ]);

  const revenue = current._sum.grandTotalPaise ?? 0;
  const previousRevenue = previous._sum.grandTotalPaise ?? 0;
  const paidOrders = current._count;

  const [lowStock, topProducts, dailyRevenue, recentOrders] = await Promise.all([
    prisma.productVariant.findMany({
      where: { isActive: true, stockQty: { lte: settings.lowStockAlertThreshold } },
      orderBy: { stockQty: "asc" },
      take: 8,
      select: {
        id: true,
        sku: true,
        label: true,
        stockQty: true,
        reservedQty: true,
        product: { select: { name: true, slug: true } },
      },
    }),
    getTopProducts(start),
    getDailyRevenue(days),
    prisma.order.findMany({
      orderBy: { placedAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        grandTotalPaise: true,
        placedAt: true,
        email: true,
        shippingAddress: true,
      },
    }),
  ]);

  return {
    days,
    revenuePaise: revenue,
    refundedPaise: current._sum.refundedPaise ?? 0,
    revenueDeltaPercent: percentChange(revenue, previousRevenue),
    paidOrders,
    ordersPlaced: orderCount,
    orderDeltaPercent: percentChange(paidOrders, previous._count),
    aovPaise: paidOrders > 0 ? Math.round(revenue / paidOrders) : 0,
    conversionPercent: orderCount > 0 ? (paidOrders / orderCount) * 100 : 0,
    pendingReview,
    statusCounts: statusGroups.map((group) => ({
      status: group.status,
      count: group._count._all,
    })),
    lowStock,
    topProducts,
    dailyRevenue,
    recentOrders,
  };
}

/** Units and revenue per product across paid orders in the window. */
async function getTopProducts(since: Date) {
  const rows = await prisma.orderItem.groupBy({
    by: ["productId", "productName", "productSlug"],
    where: {
      order: { status: { in: PAID_STATUSES }, paidAt: { gte: since } },
    },
    _sum: { quantity: true, lineTotalPaise: true },
    orderBy: { _sum: { lineTotalPaise: "desc" } },
    take: 6,
  });

  return rows.map((row) => ({
    productId: row.productId,
    name: row.productName,
    slug: row.productSlug,
    units: row._sum.quantity ?? 0,
    revenuePaise: row._sum.lineTotalPaise ?? 0,
  }));
}

/**
 * Revenue per day for the sparkline. Grouped in SQL because grouping in JS would
 * mean pulling every order row into memory.
 */
async function getDailyRevenue(days: number) {
  const rows = await prisma.$queryRaw<{ day: Date; total: bigint; orders: bigint }[]>`
    SELECT date_trunc('day', "paidAt") AS day,
           SUM("grandTotalPaise")     AS total,
           COUNT(*)                   AS orders
    FROM "Order"
    WHERE "paidAt" IS NOT NULL
      AND "paidAt" >= NOW() - (${days} || ' days')::interval
      AND "status" NOT IN ('CANCELLED', 'REFUNDED', 'RETURNED', 'PENDING_PAYMENT', 'PAYMENT_UNDER_REVIEW')
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  // Fill the gaps so the chart has an even x-axis.
  const byDay = new Map(
    rows.map((row) => [
      row.day.toISOString().slice(0, 10),
      { revenuePaise: Number(row.total), orders: Number(row.orders) },
    ]),
  );

  const series: { date: string; revenuePaise: number; orders: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const found = byDay.get(date);
    series.push({
      date,
      revenuePaise: found?.revenuePaise ?? 0,
      orders: found?.orders ?? 0,
    });
  }
  return series;
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
