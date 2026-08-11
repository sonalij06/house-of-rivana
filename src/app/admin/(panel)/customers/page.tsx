import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, DataTable, Panel, StatCard, Td } from "@/components/admin/primitives";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatDate, formatPaise } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Customers" };

const PAID_STATUSES = [
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaff("/admin/customers");
  const { q = "" } = await searchParams;
  const query = q.trim();

  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [customers, guestOrders, revenue] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: { select: { orders: true, reviews: true, wishlist: true } },
        orders: {
          where: { status: { in: [...PAID_STATUSES] } },
          orderBy: { createdAt: "desc" },
          select: { grandTotalPaise: true, createdAt: true, orderNumber: true },
        },
      },
    }),
    prisma.order.count({ where: { userId: null } }),
    prisma.order.aggregate({
      where: { status: { in: [...PAID_STATUSES] } },
      _sum: { grandTotalPaise: true },
      _count: { _all: true },
    }),
  ]);

  const orderCount = revenue._count._all;
  const aov = orderCount > 0 ? (revenue._sum.grandTotalPaise ?? 0) / orderCount : 0;

  const rows = customers
    .map((customer) => {
      const spent = customer.orders.reduce((sum, order) => sum + order.grandTotalPaise, 0);
      return {
        ...customer,
        spent,
        paidOrders: customer.orders.length,
        lastOrder: customer.orders[0] ?? null,
      };
    })
    .sort((a, b) => b.spent - a.spent);

  return (
    <>
      <AdminHeader
        title="Customers"
        description="Accounts only. Guest checkouts appear under orders with no linked account."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Accounts"
          value={String(customers.length)}
          hint={query ? "matching this search" : "newest 100"}
        />
        <StatCard label="Guest orders" value={String(guestOrders)} />
        <StatCard label="Average order" value={formatPaise(aov)} tone="gold" />
      </div>

      <div className="mb-4 flex justify-end">
        <form action="/admin/customers">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Name, email or phone…"
            aria-label="Search customers"
            className="h-9 w-60 rounded-xs border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-muted-light focus:border-gold focus:outline-none"
          />
        </form>
      </div>

      <Panel padded={false}>
        <DataTable
          head={["Customer", "Joined", "Orders", "Last order", "Spent"]}
          empty={query ? `Nothing matches “${query}”.` : "No accounts yet."}
          minWidth="50rem"
        >
          {rows.map((customer) => (
            <tr key={customer.id} className="transition-colors hover:bg-cream">
              <Td>
                <Link
                  href={`/admin/orders?q=${encodeURIComponent(customer.email)}`}
                  className="text-ink underline-offset-4 hover:underline"
                >
                  {customer.name || customer.email}
                </Link>
                <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                  {customer.email}
                  {customer.phone ? ` · ${customer.phone}` : ""}
                </span>
              </Td>
              <Td>
                <span className="text-xs text-muted">{formatDate(customer.createdAt)}</span>
              </Td>
              <Td>
                <span className="text-xs tabular-nums text-muted">
                  {customer.paidOrders} paid
                </span>
                <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                  {customer._count.orders} placed · {customer._count.reviews} reviews ·{" "}
                  {customer._count.wishlist} saved
                </span>
              </Td>
              <Td>
                {customer.lastOrder ? (
                  <>
                    <span className="font-mono text-[0.6875rem] text-muted">
                      {customer.lastOrder.orderNumber}
                    </span>
                    <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                      {formatDate(customer.lastOrder.createdAt)}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-light">—</span>
                )}
              </Td>
              <Td align="right">
                <span className="text-sm tabular-nums text-ink">
                  {formatPaise(customer.spent)}
                </span>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
