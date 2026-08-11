import type { Metadata } from "next";
import { CatalogView } from "@/components/shop/catalog-view";
import { PageHeader } from "@/components/layout/page-header";
import { getAllCollections, getShopFacets, listProducts } from "@/lib/catalog";
import { parseShopParams, type RawSearchParams } from "@/lib/shop-params";
import { getWishlistedProductIds } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: "Shop all jewellery",
  description:
    "Browse House of Rivana fashion jewellery — rings, necklaces, earrings and bracelets in gold-plated, rose gold-plated and silver-tone finishes with CZ and AD stones.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const filters = parseShopParams(params);

  const [result, facets, collections, wishlisted] = await Promise.all([
    listProducts(filters),
    getShopFacets(),
    getAllCollections(),
    getWishlistedProductIds(),
  ]);

  const activeCollection = collections.find((c) => c.slug === filters.collection);

  return (
    <div className="container-site py-12 md:py-16">
      <PageHeader
        eyebrow="The collection"
        title={activeCollection ? activeCollection.name : "All jewellery"}
        description={
          activeCollection?.description ??
          "Artificial fashion jewellery in small drops — plated finishes, CZ and AD sparkle, made to be worn every day and to celebrations."
        }
        crumbs={[
          { label: "Shop", href: "/shop" },
          ...(activeCollection ? [{ label: activeCollection.name }] : []),
        ]}
      />

      <CatalogView
        products={result.items}
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
        filters={filters}
        facets={facets}
        collections={collections.map((c) => ({
          slug: c.slug,
          name: c.name,
          count: c._count.products,
        }))}
        basePath="/shop"
        searchParams={params}
        wishlisted={wishlisted}
      />
    </div>
  );
}
