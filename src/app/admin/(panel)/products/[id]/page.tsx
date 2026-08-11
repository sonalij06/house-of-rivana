import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { AdminHeader, Panel } from "@/components/admin/primitives";
import { ImageManager } from "@/components/admin/image-manager";
import { ProductForm } from "@/components/admin/product-form";
import { VariantEditor } from "@/components/admin/variant-editor";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { storageConfigured } from "@/lib/storage";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("/admin/products");
  const { id } = await params;

  const [product, collections] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { sortOrder: "asc" } },
        collections: { select: { collectionId: true } },
        _count: { select: { orderItems: true, reviews: true } },
      },
    }),
    prisma.collection.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!product) notFound();

  return (
    <>
      <AdminHeader
        title={product.name}
        description={`Updated ${formatDate(product.updatedAt, true)} · ${product._count.orderItems} sold · ${product._count.reviews} reviews`}
        back={{ href: "/admin/products", label: "All products" }}
      >
        <Link
          href={`/product/${product.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 border border-hairline px-3 py-1.5 text-[0.625rem] uppercase tracking-[0.12em] text-muted transition-colors hover:border-ink hover:text-ink"
        >
          <ExternalLink className="size-3" />
          View on the site
        </Link>
      </AdminHeader>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr] xl:items-start">
        <div className="space-y-5">
          <ProductForm
            hasOrders={product._count.orderItems > 0}
            collections={collections}
            initial={{
              id: product.id,
              slug: product.slug,
              name: product.name,
              shortDescription: product.shortDescription ?? "",
              description: product.description,
              story: product.story ?? "",
              metal: product.metal,
              purity: product.purity ?? "",
              gemstone: product.gemstone ?? "",
              weightGrams: product.weightGrams,
              dimensions: product.dimensions ?? "",
              careInstructions: product.careInstructions ?? "",
              basePriceRupees: product.basePricePaise / 100,
              compareAtRupees: product.compareAtPaise
                ? product.compareAtPaise / 100
                : null,
              status: product.status,
              isFeatured: product.isFeatured,
              isBestseller: product.isBestseller,
              isNewArrival: product.isNewArrival,
              madeToOrderDays: product.madeToOrderDays,
              metaTitle: product.metaTitle ?? "",
              metaDescription: product.metaDescription ?? "",
              collectionIds: product.collections.map((c) => c.collectionId),
            }}
          />
        </div>

        <div className="space-y-5">
          <Panel title="Photographs">
            <ImageManager
              productId={product.id}
              storageReady={storageConfigured}
              images={product.images.map((image) => ({
                id: image.id,
                url: image.url,
                alt: image.alt,
                isPrimary: image.isPrimary,
              }))}
            />
          </Panel>

          <VariantEditor
            productId={product.id}
            productSlug={product.slug}
            variants={product.variants.map((variant) => ({
              id: variant.id,
              sku: variant.sku,
              label: variant.label,
              optionSize: variant.optionSize,
              optionMetal: variant.optionMetal,
              optionLength: variant.optionLength,
              pricePaise: variant.pricePaise,
              compareAtPaise: variant.compareAtPaise,
              stockQty: variant.stockQty,
              reservedQty: variant.reservedQty,
              lowStockThreshold: variant.lowStockThreshold,
              isActive: variant.isActive,
              sortOrder: variant.sortOrder,
            }))}
          />
        </div>
      </div>
    </>
  );
}
