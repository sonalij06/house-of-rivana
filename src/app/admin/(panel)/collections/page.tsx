import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/primitives";
import { CollectionManager } from "@/components/admin/collection-manager";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Collections" };

export default async function AdminCollectionsPage() {
  await requireStaff("/admin/collections");

  const collections = await prisma.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <AdminHeader
        title="Collections"
        description="Collections are how the storefront groups pieces — the homepage features them, and /shop filters by them."
      />

      <CollectionManager
        collections={collections.map((collection) => ({
          id: collection.id,
          slug: collection.slug,
          name: collection.name,
          subtitle: collection.subtitle,
          description: collection.description,
          heroImage: collection.heroImage,
          sortOrder: collection.sortOrder,
          isActive: collection.isActive,
          isFeatured: collection.isFeatured,
          metaTitle: collection.metaTitle,
          metaDescription: collection.metaDescription,
          productCount: collection._count.products,
        }))}
      />
    </>
  );
}
