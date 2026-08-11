import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ORDER_STATUS_COPY, type OrderStatus } from "@/lib/order-status";
import { formatDate, formatPaise } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

export default async function AccountOrdersPage() {
  const user = await requireUser("/account/orders");

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { placedAt: "desc" },
    include: {
      items: {
        take: 3,
        select: {
          id: true,
          productName: true,
          variantLabel: true,
          quantity: true,
          imageUrl: true,
        },
      },
      _count: { select: { items: true } },
    },
  });

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Package className="size-5" strokeWidth={1.5} />}
        title="No orders yet"
        description="Once you place an order, you can track it here."
        action={
          <Button asChild>
            <Link href="/shop">Shop the collection</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Orders</h2>
      <p className="mt-1 text-sm text-muted">
        Every piece you have ordered, with live status and tracking.
      </p>

      <ul className="mt-8 space-y-4">
        {orders.map((order) => {
          const copy = ORDER_STATUS_COPY[order.status as OrderStatus];
          return (
            <li key={order.id} className="border border-hairline bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-ink">{order.orderNumber}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Placed {formatDate(order.placedAt, true)}
                  </p>
                </div>
                <div className="text-right">
                  <Badge tone={copy.tone === "danger" ? "danger" : copy.tone === "success" ? "success" : copy.tone === "warning" ? "warning" : "neutral"}>
                    {copy.label}
                  </Badge>
                  <p className="mt-2 text-sm tabular-nums text-ink">
                    {formatPaise(order.grandTotalPaise)}
                  </p>
                </div>
              </div>
              <div className="px-5 py-4">
                <ul className="space-y-1.5 text-sm text-muted">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.productName}
                      {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                    </li>
                  ))}
                  {order._count.items > order.items.length ? (
                    <li className="text-xs text-muted-light">
                      +{order._count.items - order.items.length} more
                    </li>
                  ) : null}
                </ul>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href={`/order/${order.orderNumber}?t=${order.accessToken}`}>
                    View order
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
