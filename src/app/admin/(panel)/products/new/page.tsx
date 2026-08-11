import type { Metadata } from "next";
import { AdminHeader, Panel } from "@/components/admin/primitives";
import { ProductForm } from "@/components/admin/product-form";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireStaff("/admin/products");

  const collections = await prisma.collection.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <AdminHeader
        title="New product"
        description="Save the details first; photographs and variants unlock once the piece exists."
        back={{ href: "/admin/products", label: "All products" }}
      />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr] xl:items-start">
        <ProductForm
          hasOrders={false}
          collections={collections}
          initial={{
            slug: "",
            name: "",
            shortDescription: "",
            description: "",
            story: "",
            metal: "YELLOW_GOLD",
            purity: "",
            gemstone: "",
            weightGrams: null,
            dimensions: "",
            careInstructions: "",
            basePriceRupees: 1000,
            compareAtRupees: null,
            status: "DRAFT",
            isFeatured: false,
            isBestseller: false,
            isNewArrival: true,
            madeToOrderDays: null,
            metaTitle: "",
            metaDescription: "",
            collectionIds: [],
          }}
        />

        <Panel title="What happens next">
          <ol className="space-y-3 text-sm leading-relaxed text-muted">
            <li>
              <strong className="text-ink">1.</strong> Save the piece as a draft. Nothing
              is visible on the storefront until you set it live.
            </li>
            <li>
              <strong className="text-ink">2.</strong> Add photographs. The first one
              becomes the card and hero image.
            </li>
            <li>
              <strong className="text-ink">3.</strong> Add at least one variant with a SKU,
              a price and opening stock. A piece with no variant cannot be bought.
            </li>
            <li>
              <strong className="text-ink">4.</strong> Switch the status to live.
            </li>
          </ol>
        </Panel>
      </div>
    </>
  );
}
