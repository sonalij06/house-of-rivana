import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, DataTable, Panel, StatCard, Td } from "@/components/admin/primitives";
import { StockAdjuster } from "@/components/admin/stock-adjuster";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Inventory" };

const FILTERS = [
  { key: "all", label: "Everything" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Sold out" },
  { key: "held", label: "Reserved" },
];

const MOVEMENT_COPY: Record<string, string> = {
  ORDER: "Sold",
  RESTOCK: "Restocked",
  ADJUSTMENT: "Corrected",
  RETURN: "Returned",
  CANCELLATION: "Order cancelled",
  DAMAGE: "Damaged",
};

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  await requireStaff("/admin/inventory");
  const { view = "all", q = "" } = await searchParams;
  const query = q.trim();

  const where: Prisma.ProductVariantWhereInput = {
    ...(view === "out" ? { stockQty: { lte: 0 } } : {}),
    ...(view === "held" ? { reservedQty: { gt: 0 } } : {}),
    ...(query
      ? {
          OR: [
            { sku: { contains: query, mode: "insensitive" } },
            { product: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [variants, movements, totals] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      orderBy: [{ stockQty: "asc" }, { sku: "asc" }],
      take: 200,
      select: {
        id: true,
        sku: true,
        label: true,
        stockQty: true,
        reservedQty: true,
        lowStockThreshold: true,
        isActive: true,
        product: { select: { id: true, name: true, status: true } },
      },
    }),
    prisma.inventoryMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        delta: true,
        reason: true,
        balanceAfter: true,
        note: true,
        createdAt: true,
        variant: { select: { sku: true, product: { select: { name: true } } } },
        actor: { select: { name: true, email: true } },
      },
    }),
    prisma.productVariant.aggregate({
      _sum: { stockQty: true, reservedQty: true },
      _count: { _all: true },
    }),
  ]);

  // Low stock is per-variant (each has its own threshold), so it is filtered here
  // rather than in SQL where column-to-column comparison needs raw SQL.
  const rows =
    view === "low"
      ? variants.filter(
          (variant) => variant.stockQty > 0 && variant.stockQty <= variant.lowStockThreshold,
        )
      : variants;

  const lowCount = variants.filter(
    (variant) => variant.stockQty > 0 && variant.stockQty <= variant.lowStockThreshold,
  ).length;
  const outCount = variants.filter((variant) => variant.stockQty <= 0).length;

  return (
    <>
      <AdminHeader
        title="Inventory"
        description="Stock only moves through the ledger. Every adjustment here is recorded with who made it and why."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Units on hand"
          value={String(totals._sum.stockQty ?? 0)}
          hint={`${totals._count._all} variants`}
        />
        <StatCard
          label="Reserved for orders"
          value={String(totals._sum.reservedQty ?? 0)}
          hint="Held during checkout"
          tone="gold"
        />
        <StatCard
          label="Low stock"
          value={String(lowCount)}
          hint="At or below threshold"
          tone={lowCount > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="Sold out"
          value={String(outCount)}
          tone={outCount > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-hairline pb-3">
        {FILTERS.map((filter) => (
          <Link
            key={filter.key}
            href={`/admin/inventory?view=${filter.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
            className={
              filter.key === view
                ? "rounded-xs bg-ink px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-cream"
                : "rounded-xs px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-muted transition-colors hover:bg-cream-dark hover:text-ink"
            }
          >
            {filter.label}
          </Link>
        ))}

        <form action="/admin/inventory" className="ml-auto">
          <input type="hidden" name="view" value={view} />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="SKU or piece…"
            aria-label="Search inventory"
            className="h-9 w-52 rounded-xs border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-muted-light focus:border-gold focus:outline-none"
          />
        </form>
      </div>

      <Panel padded={false} className="mb-5">
        <DataTable
          head={["SKU", "Piece", "Variant", "Reserved", "On hand"]}
          empty={query ? `Nothing matches “${query}”.` : "No variants in this view."}
          minWidth="52rem"
        >
          {rows.map((variant) => (
            <tr key={variant.id} className={variant.isActive ? undefined : "opacity-55"}>
              <Td>
                <span className="font-mono text-[0.6875rem] text-muted">{variant.sku}</span>
              </Td>
              <Td>
                <Link
                  href={`/admin/products/${variant.product.id}`}
                  className="text-ink underline-offset-4 hover:underline"
                >
                  {variant.product.name}
                </Link>
                {variant.product.status !== "ACTIVE" ? (
                  <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                    {variant.product.status.toLowerCase()}
                  </span>
                ) : null}
              </Td>
              <Td>
                <span className="text-xs text-muted">{variant.label}</span>
              </Td>
              <Td>
                <span className="text-xs tabular-nums text-muted">
                  {variant.reservedQty > 0 ? variant.reservedQty : "—"}
                </span>
              </Td>
              <Td align="right">
                <StockAdjuster
                  variantId={variant.id}
                  sku={variant.sku}
                  stockQty={variant.stockQty}
                  lowStockThreshold={variant.lowStockThreshold}
                />
              </Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel title="Recent movements" padded={false}>
        <DataTable
          head={["When", "SKU", "Reason", "Change", "Balance"]}
          empty="No stock has moved yet."
          minWidth="46rem"
        >
          {movements.map((movement) => (
            <tr key={movement.id}>
              <Td>
                <span className="text-xs text-muted">
                  {formatDate(movement.createdAt, true)}
                </span>
              </Td>
              <Td>
                <span className="font-mono text-[0.6875rem] text-muted">
                  {movement.variant.sku}
                </span>
                <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                  {movement.variant.product.name}
                </span>
              </Td>
              <Td>
                <span className="text-xs text-ink">
                  {MOVEMENT_COPY[movement.reason] ?? movement.reason}
                </span>
                {movement.note ? (
                  <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                    {movement.note}
                    {movement.actor
                      ? ` — ${movement.actor.name ?? movement.actor.email}`
                      : ""}
                  </span>
                ) : null}
              </Td>
              <Td>
                <span
                  className={
                    movement.delta > 0
                      ? "text-xs tabular-nums text-success"
                      : "text-xs tabular-nums text-danger"
                  }
                >
                  {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                </span>
              </Td>
              <Td align="right">
                <span className="text-xs tabular-nums text-muted">
                  {movement.balanceAfter}
                </span>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
