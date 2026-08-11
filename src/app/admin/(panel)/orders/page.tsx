import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, DataTable, Panel, StatusPill, Td } from "@/components/admin/primitives";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatDate, formatPaise } from "@/lib/utils";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Orders" };

const TABS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: "open", label: "Open", statuses: ["CONFIRMED", "PROCESSING", "PACKED"] },
  { key: "review", label: "To verify", statuses: ["PAYMENT_UNDER_REVIEW"] },
  { key: "unpaid", label: "Unpaid", statuses: ["PENDING_PAYMENT"] },
  { key: "shipped", label: "Shipped", statuses: ["SHIPPED"] },
  { key: "delivered", label: "Delivered", statuses: ["DELIVERED"] },
  {
    key: "problems",
    label: "Returns & refunds",
    statuses: ["RETURN_REQUESTED", "RETURNED", "REFUNDED", "CANCELLED"],
  },
  { key: "all", label: "All" },
];

const PAGE_SIZE = 25;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  await requireStaff("/admin/orders");
  const { tab = "open", q = "", page = "1" } = await searchParams;

  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const currentPage = Math.max(1, Number(page) || 1);
  const query = q.trim();

  const where: Prisma.OrderWhereInput = {
    ...(active.statuses ? { status: { in: active.statuses } } : {}),
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
            { payments: { some: { upiUtr: { contains: query } } } },
          ],
        }
      : {}),
  };

  const [orders, total, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        grandTotalPaise: true,
        placedAt: true,
        email: true,
        shippingAddress: true,
        _count: { select: { items: true } },
        shipments: { select: { awb: true, carrier: true }, take: 1 },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status, c._count._all]));
  const tabCount = (statuses?: OrderStatus[]) =>
    statuses
      ? statuses.reduce((sum, status) => sum + (countByStatus.get(status) ?? 0), 0)
      : counts.reduce((sum, c) => sum + c._count._all, 0);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (params: Record<string, string | number>) => {
    const search = new URLSearchParams({ tab, ...(query ? { q: query } : {}) });
    for (const [key, value] of Object.entries(params)) search.set(key, String(value));
    return `/admin/orders?${search.toString()}`;
  };

  return (
    <>
      <AdminHeader
        title="Orders"
        description="Search by order number, email, phone or UPI reference."
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-hairline pb-3">
        {TABS.map((option) => {
          const count = tabCount(option.statuses);
          const isActive = option.key === active.key;
          return (
            <Link
              key={option.key}
              href={`/admin/orders?tab=${option.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              className={
                isActive
                  ? "rounded-xs bg-ink px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-cream"
                  : "rounded-xs px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-muted transition-colors hover:bg-cream-dark hover:text-ink"
              }
            >
              {option.label}
              <span className={isActive ? "ml-1.5 text-champagne" : "ml-1.5 text-muted-light"}>
                {count}
              </span>
            </Link>
          );
        })}

        <form action="/admin/orders" className="ml-auto flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Order, email, UTR…"
            aria-label="Search orders"
            className="h-9 w-52 rounded-xs border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-muted-light focus:border-gold focus:outline-none"
          />
        </form>
      </div>

      <Panel padded={false}>
        <DataTable
          head={["Order", "Customer", "Placed", "Status", "Total"]}
          empty={query ? `Nothing matches “${query}”.` : "No orders in this view."}
        >
          {orders.map((order) => {
            const address = order.shippingAddress as {
              fullName?: string;
              city?: string;
            } | null;
            return (
              <tr key={order.id} className="transition-colors hover:bg-cream">
                <Td>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-mono text-[0.75rem] text-ink underline-offset-4 hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <span className="ml-2 text-[0.6875rem] text-muted-light">
                    {order._count.items} {order._count.items === 1 ? "item" : "items"}
                  </span>
                  {order.shipments[0]?.awb ? (
                    <span className="mt-0.5 block font-mono text-[0.625rem] text-muted-light">
                      {order.shipments[0].carrier} {order.shipments[0].awb}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <span className="text-ink">{address?.fullName ?? "Guest"}</span>
                  <span className="mt-0.5 block text-[0.6875rem] text-muted-light">
                    {order.email}
                    {address?.city ? ` · ${address.city}` : ""}
                  </span>
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

      {pageCount > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-xs text-muted">
          <span className="tabular-nums">
            Page {currentPage} of {pageCount} · {total} orders
          </span>
          <span className="flex gap-2">
            {currentPage > 1 ? (
              <Link
                href={href({ page: currentPage - 1 })}
                className="border border-hairline px-3 py-1.5 uppercase tracking-[0.12em] transition-colors hover:border-ink hover:text-ink"
              >
                Previous
              </Link>
            ) : null}
            {currentPage < pageCount ? (
              <Link
                href={href({ page: currentPage + 1 })}
                className="border border-hairline px-3 py-1.5 uppercase tracking-[0.12em] transition-colors hover:border-ink hover:text-ink"
              >
                Next
              </Link>
            ) : null}
          </span>
        </nav>
      ) : null}
    </>
  );
}
