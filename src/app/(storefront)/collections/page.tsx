import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CollectionShowcase } from "@/components/home/collection-showcase";
import { getAllCollections } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Collections",
  description:
    "Explore the House of Rivana collections — each one a small, deliberate edit built around a single idea.",
  alternates: { canonical: "/collections" },
};

export default async function CollectionsPage() {
  const collections = await getAllCollections();

  return (
    <div className="container-site py-12 md:py-16">
      <PageHeader
        eyebrow="Edits"
        title="Our collections"
        description="Each collection is a small, deliberate edit — one idea, explored across a handful of pieces, then closed."
        crumbs={[{ label: "Collections" }]}
        align="center"
      />

      <div className="mt-14">
        <CollectionShowcase
          collections={collections.map((collection) => ({
            slug: collection.slug,
            name: collection.name,
            subtitle: collection.subtitle,
            heroImage: collection.heroImage,
            productCount: collection._count.products,
          }))}
        />
      </div>
    </div>
  );
}
