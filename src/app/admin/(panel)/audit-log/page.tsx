import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, DataTable, Panel, Td } from "@/components/admin/primitives";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 60;

const ACTION_COPY: Record<string, string> = {
  "settings.update": "Updated settings",
  "settings.payment-provider": "Switched payment provider",
  "payment.verify": "Verified a payment",
  "payment.reject": "Declined a payment",
  "order.status": "Changed an order status",
  "order.cancel": "Cancelled an order",
  "order.refund": "Issued a refund",
  "order.note": "Added an order note",
  "shipment.create": "Created a shipment",
  "product.create": "Created a product",
  "product.update": "Updated a product",
  "product.delete": "Deleted a product",
  "product.archive": "Archived a product",
  "product.flag": "Changed homepage placement",
  "product.images.upload": "Uploaded images",
  "product.images.remove": "Removed an image",
  "variant.create": "Created a variant",
  "variant.update": "Updated a variant",
  "variant.delete": "Deleted a variant",
  "variant.deactivate": "Deactivated a variant",
  "inventory.adjust": "Adjusted stock",
  "collection.create": "Created a collection",
  "collection.update": "Updated a collection",
  "collection.delete": "Deleted a collection",
  "coupon.create": "Created a coupon",
  "coupon.update": "Updated a coupon",
  "coupon.enable": "Enabled a coupon",
  "coupon.disable": "Disabled a coupon",
  "coupon.delete": "Deleted a coupon",
  "review.approve": "Published a review",
  "review.reject": "Rejected a review",
  "review.delete": "Deleted a review",
  "hero.create": "Added a hero slide",
  "hero.update": "Updated a hero slide",
  "hero.delete": "Deleted a hero slide",
  "user.role": "Changed a role",
  "user.suspend": "Suspended an account",
  "user.restore": "Restored an account",
  "contact.handled": "Handled a message",
};

/** Only the fields worth eyeballing — full payloads live in the JSON columns. */
function summarise(value: Prisma.JsonValue | null) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const interesting = [
    "status",
    "role",
    "isActive",
    "banned",
    "delta",
    "balance",
    "sku",
    "code",
    "name",
    "reason",
    "amountPaise",
    "awb",
    "activePaymentProvider",
  ];
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, entry]) => interesting.includes(key) && entry !== null)
    .slice(0, 4)
    .map(([key, entry]) => `${key}: ${String(entry)}`);
  return entries.length > 0 ? entries.join(" · ") : null;
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string }>;
}) {
  await requireAdmin("/admin/audit-log");
  const { page = "1", entity = "all" } = await searchParams;
  const current = Math.max(1, Number(page) || 1);

  const where: Prisma.AdminAuditLogWhereInput =
    entity === "all" ? {} : { entity };

  const [entries, total, entities] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        actorEmail: true,
        action: true,
        entity: true,
        entityId: true,
        before: true,
        after: true,
        ipAddress: true,
        createdAt: true,
      },
    }),
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.groupBy({ by: ["entity"], _count: { _all: true } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AdminHeader
        title="Audit log"
        description="Every staff mutation, append-only. Useful when a price, a status or a stock count is not what you expected."
      />

      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-hairline pb-3">
        <Link
          href="/admin/audit-log"
          className={
            entity === "all"
              ? "rounded-xs bg-ink px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-cream"
              : "rounded-xs px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-muted transition-colors hover:bg-cream-dark hover:text-ink"
          }
        >
          All
          <span className="ml-1.5 text-muted-light">{total}</span>
        </Link>
        {entities
          .sort((a, b) => b._count._all - a._count._all)
          .map((row) => (
            <Link
              key={row.entity}
              href={`/admin/audit-log?entity=${encodeURIComponent(row.entity)}`}
              className={
                entity === row.entity
                  ? "rounded-xs bg-ink px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-cream"
                  : "rounded-xs px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-muted transition-colors hover:bg-cream-dark hover:text-ink"
              }
            >
              {row.entity}
              <span
                className={
                  entity === row.entity ? "ml-1.5 text-champagne" : "ml-1.5 text-muted-light"
                }
              >
                {row._count._all}
              </span>
            </Link>
          ))}
      </div>

      <Panel padded={false}>
        <DataTable
          head={["When", "Who", "What", "Record", "Detail"]}
          empty="Nothing recorded yet."
          minWidth="56rem"
        >
          {entries.map((entry) => {
            const detail = summarise(entry.after) ?? summarise(entry.before);
            return (
              <tr key={entry.id}>
                <Td>
                  <span className="whitespace-nowrap text-xs text-muted">
                    {formatDate(entry.createdAt, true)}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs text-ink">{entry.actorEmail}</span>
                  {entry.ipAddress ? (
                    <span className="mt-0.5 block font-mono text-[0.5625rem] text-muted-light">
                      {entry.ipAddress}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <span className="text-xs text-ink">
                    {ACTION_COPY[entry.action] ?? entry.action}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs text-muted">{entry.entity}</span>
                  {entry.entityId ? (
                    <span className="mt-0.5 block font-mono text-[0.5625rem] text-muted-light">
                      {entry.entityId}
                    </span>
                  ) : null}
                </Td>
                <Td align="right">
                  <span className="text-[0.6875rem] text-muted">{detail ?? "—"}</span>
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      {pageCount > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-[0.6875rem] uppercase tracking-[0.14em]">
          {current > 1 ? (
            <Link
              href={`/admin/audit-log?entity=${entity}&page=${current - 1}`}
              className="text-muted transition-colors hover:text-gold"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-light">
            Page {current} of {pageCount}
          </span>
          {current < pageCount ? (
            <Link
              href={`/admin/audit-log?entity=${entity}&page=${current + 1}`}
              className="text-muted transition-colors hover:text-gold"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
