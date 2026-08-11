import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminHeader, DataTable, Panel, StatusPill, Td } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { prisma } from "@/lib/db";
import { metalLabel } from "@/lib/product";
import { requireStaff } from "@/lib/session";
import { formatPaise } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Products" };

const TABS = [
  { key: "all", label: "All" },
  { key: "ACTIVE", label: "Live" },
  { key: "DRAFT", label: "Drafts" },
  { key: "ARCHIVED", label: "Archived" },
];

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireStaff("/admin/products");
  const { status = "all", q = "" } = await searchParams;
  const query = q.trim();

  const where: Prisma.ProductWhereInput = {
    ...(status !== "all" ? { status: status as "ACTIVE" | "DRAFT" | "ARCHIVED" } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
            { variants: { some: { sku: { contains: query, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [products, counts] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 60,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        metal: true,
        basePricePaise: true,
        ratingAverage: true,
        ratingCount: true,
        soldCount: true,
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { url: true, alt: true },
        },
        variants: { select: { stockQty: true, reservedQty: true, isActive: true } },
        collections: { select: { collection: { select: { name: true } } } },
      },
    }),
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status as string, c._count._all]));

  return (
    <>
      <AdminHeader
        title="Products"
        description="Every piece in the catalogue, with live stock across its variants."
      >
        <Button asChild size="sm">
          <Link href="/admin/products/new">
            <Plus className="size-3.5" strokeWidth={2} />
            New product
          </Link>
        </Button>
      </AdminHeader>

      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-hairline pb-3">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/products?status=${tab.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
            className={
              tab.key === status
                ? "rounded-xs bg-ink px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-cream"
                : "rounded-xs px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-muted transition-colors hover:bg-cream-dark hover:text-ink"
            }
          >
            {tab.label}
            <span
              className={
                tab.key === status ? "ml-1.5 text-champagne" : "ml-1.5 text-muted-light"
              }
            >
              {tab.key === "all"
                ? counts.reduce((sum, c) => sum + c._count._all, 0)
                : (countByStatus.get(tab.key) ?? 0)}
            </span>
          </Link>
        ))}

        <form action="/admin/products" className="ml-auto">
          <input type="hidden" name="status" value={status} />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Name, slug or SKU…"
            aria-label="Search products"
            className="h-9 w-52 rounded-xs border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-muted-light focus:border-gold focus:outline-none"
          />
        </form>
      </div>

      <Panel padded={false}>
        <DataTable
          head={["Piece", "Collections", "From", "Stock", "Status"]}
          empty={query ? `Nothing matches “${query}”.` : "No products yet."}
        >
          {products.map((product) => {
            const onHand = product.variants.reduce(
              (sum, v) => sum + Math.max(0, v.stockQty - v.reservedQty),
              0,
            );
            const activeVariants = product.variants.filter((v) => v.isActive).length;

            return (
              <tr key={product.id} className="transition-colors hover:bg-cream">
                <Td>
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="flex items-center gap-3"
                  >
                    <span className="relative size-10 shrink-0 overflow-hidden bg-cream-dark">
                      <SafeImage
                        src={product.images[0]?.url ?? null}
                        alt={product.images[0]?.alt ?? product.name}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-ink underline-offset-4 hover:underline">
                        {product.name}
                      </span>
                      <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                        {metalLabel(product.metal)} · {activeVariants}{" "}
                        {activeVariants === 1 ? "variant" : "variants"}
                        {product.ratingCount > 0
                          ? ` · ${product.ratingAverage.toFixed(1)}★ (${product.ratingCount})`
                          : ""}
                      </span>
                    </span>
                  </Link>
                </Td>
                <Td>
                  <span className="text-xs text-muted">
                    {product.collections.length
                      ? product.collections.map((c) => c.collection.name).join(", ")
                      : "—"}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs tabular-nums text-ink">
                    {formatPaise(product.basePricePaise)}
                  </span>
                </Td>
                <Td>
                  <span
                    className={
                      onHand === 0
                        ? "text-xs tabular-nums text-danger"
                        : onHand <= 3
                          ? "text-xs tabular-nums text-warning"
                          : "text-xs tabular-nums text-muted"
                    }
                  >
                    {onHand} available
                  </span>
                  {product.soldCount > 0 ? (
                    <span className="mt-0.5 block text-[0.625rem] text-muted-light">
                      {product.soldCount} sold
                    </span>
                  ) : null}
                </Td>
                <Td align="right">
                  <StatusPill
                    status={product.status === "ACTIVE" ? "CONFIRMED" : product.status}
                    label={product.status.toLowerCase()}
                  />
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
    </>
  );
}
