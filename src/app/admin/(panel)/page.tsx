import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Wallet } from "lucide-react";
import {
  AdminHeader,
  DataTable,
  Panel,
  StatCard,
  StatusPill,
  Td,
} from "@/components/admin/primitives";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { Button } from "@/components/ui/button";
import { getDashboardMetrics, type DashboardRange } from "@/lib/analytics";
import { requireStaff } from "@/lib/session";
import { formatDate, formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const RANGES: DashboardRange[] = [7, 30, 90, 365];

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireStaff();
  const { range } = await searchParams;
  const days = (RANGES.find((r) => String(r) === range) ?? 30) as DashboardRange;
  const metrics = await getDashboardMetrics(days);

  const firstName = user.name.split(" ")[0];

  return (
    <>
      <AdminHeader
        title={`Good ${greeting()}, ${firstName}`}
        description={`Paid revenue and orders over the last ${days} days. Revenue excludes unpaid, cancelled and refunded orders.`}
      >
        <div className="flex overflow-hidden rounded-xs border border-hairline">
          {RANGES.map((option) => (
            <Link
              key={option}
              href={`/admin?range=${option}`}
              className={
                option === days
                  ? "bg-ink px-3 py-1.5 text-[0.625rem] uppercase tracking-[0.12em] text-cream"
                  : "bg-surface px-3 py-1.5 text-[0.625rem] uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
              }
            >
              {option === 365 ? "1y" : `${option}d`}
            </Link>
          ))}
        </div>
      </AdminHeader>

      {metrics.pendingReview > 0 ? (
        <Link
          href="/admin/payments/review"
          className="mb-5 flex items-center justify-between gap-4 border border-gold/30 bg-champagne-soft px-5 py-4 transition-colors hover:border-gold"
        >
          <span className="flex items-center gap-3 text-sm text-ink">
            <Wallet className="size-4 shrink-0 text-gold" strokeWidth={1.6} />
            {metrics.pendingReview}{" "}
            {metrics.pendingReview === 1 ? "payment is" : "payments are"} waiting to be
            verified. Nothing ships until they clear.
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-gold" strokeWidth={1.6} />
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Paid revenue"
          value={formatPaise(metrics.revenuePaise)}
          delta={{ value: metrics.revenueDeltaPercent }}
          hint="vs previous period"
          tone="gold"
        />
        <StatCard
          label="Paid orders"
          value={String(metrics.paidOrders)}
          delta={{ value: metrics.orderDeltaPercent }}
          hint={`${metrics.ordersPlaced} placed`}
        />
        <StatCard
          label="Average order"
          value={formatPaise(metrics.aovPaise)}
          hint="per paid order"
        />
        <StatCard
          label="Payment conversion"
          value={`${metrics.conversionPercent.toFixed(0)}%`}
          hint="placed orders that got paid"
          tone={metrics.conversionPercent < 60 ? "danger" : "neutral"}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Revenue">
          <RevenueChart data={metrics.dailyRevenue} />
        </Panel>

        <Panel title="Orders by status">
          <ul className="space-y-2.5">
            {metrics.statusCounts.length === 0 ? (
              <li className="text-sm text-muted">No orders yet.</li>
            ) : (
              metrics.statusCounts.map((entry) => {
                const total = metrics.statusCounts.reduce((sum, s) => sum + s.count, 0);
                const share = total > 0 ? (entry.count / total) * 100 : 0;
                return (
                  <li key={entry.status}>
                    <div className="flex items-baseline justify-between gap-3">
                      <StatusPill status={entry.status} />
                      <span className="text-sm tabular-nums text-ink">{entry.count}</span>
                    </div>
                    <div className="mt-1.5 h-px w-full bg-hairline">
                      <div
                        className="h-px bg-gold"
                        style={{ width: `${Math.max(share, 1)}%` }}
                      />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Top pieces" padded={false}>
          <DataTable
            head={["Product", "Units", "Revenue"]}
            empty="No paid orders in this period."
            minWidth="20rem"
          >
            {metrics.topProducts.map((product) => (
              <tr key={product.slug} className="transition-colors hover:bg-cream">
                <Td>
                  <Link
                    href={`/product/${product.slug}`}
                    className="text-ink underline-offset-4 hover:underline"
                  >
                    {product.name}
                  </Link>
                </Td>
                <Td>
                  <span className="tabular-nums text-muted">{product.units}</span>
                </Td>
                <Td align="right">
                  <span className="tabular-nums text-ink">
                    {formatPaise(product.revenuePaise)}
                  </span>
                </Td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        <Panel
          title="Low stock"
          padded={false}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/inventory">Adjust</Link>
            </Button>
          }
        >
          <DataTable
            head={["Variant", "SKU", "On hand"]}
            empty="Every active variant is above its alert level."
            minWidth="24rem"
          >
            {metrics.lowStock.map((variant) => (
              <tr key={variant.id} className="transition-colors hover:bg-cream">
                <Td>
                  <Link
                    href={`/product/${variant.product.slug}`}
                    className="text-ink underline-offset-4 hover:underline"
                  >
                    {variant.product.name}
                  </Link>
                  <span className="ml-2 text-xs text-muted">{variant.label}</span>
                </Td>
                <Td>
                  <span className="font-mono text-[0.6875rem] text-muted">
                    {variant.sku}
                  </span>
                </Td>
                <Td align="right">
                  <span
                    className={
                      variant.stockQty <= 0
                        ? "inline-flex items-center gap-1.5 tabular-nums text-danger"
                        : "inline-flex items-center gap-1.5 tabular-nums text-warning"
                    }
                  >
                    {variant.stockQty <= 0 ? (
                      <AlertTriangle className="size-3" strokeWidth={1.8} />
                    ) : null}
                    {variant.stockQty}
                    {variant.reservedQty > 0 ? (
                      <span className="text-muted-light">
                        ({variant.reservedQty} held)
                      </span>
                    ) : null}
                  </span>
                </Td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>

      <Panel
        title="Latest orders"
        className="mt-5"
        padded={false}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/orders">All orders</Link>
          </Button>
        }
      >
        <DataTable head={["Order", "Customer", "Placed", "Status", "Total"]}>
          {metrics.recentOrders.map((order) => {
            const address = order.shippingAddress as { fullName?: string } | null;
            return (
              <tr key={order.id} className="transition-colors hover:bg-cream">
                <Td>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-mono text-[0.75rem] text-ink underline-offset-4 hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                </Td>
                <Td>
                  <span className="text-ink">{address?.fullName ?? "—"}</span>
                  <span className="ml-2 text-xs text-muted-light">{order.email}</span>
                </Td>
                <Td>
                  <span className="text-xs tabular-nums text-muted">
                    {formatDate(order.placedAt, true)}
                  </span>
                </Td>
                <Td>
                  <StatusPill status={order.status} />
                </Td>
                <Td align="right">
                  <span className="tabular-nums text-ink">
                    {formatPaise(order.grandTotalPaise)}
                  </span>
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
    </>
  );
}

function greeting() {
  // Server time is UTC on Vercel; IST is the studio's clock.
  const hour = (new Date().getUTCHours() + 5) % 24;
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
