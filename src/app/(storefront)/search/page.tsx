import type { Metadata } from "next";
import { CatalogView } from "@/components/shop/catalog-view";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getAllCollections, getShopFacets, listProducts } from "@/lib/catalog";
import { parseShopParams, type RawSearchParams } from "@/lib/shop-params";
import { getWishlistedProductIds } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: "Search",
  // A results page has nothing durable to index.
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const filters = parseShopParams(params);

  if (!filters.search) {
    return (
      <div className="container-site py-12 md:py-16">
        <PageHeader title="Search" crumbs={[{ label: "Search" }]} align="center" />
        <EmptyState
          className="mt-10"
          title="What are you looking for?"
          description="Search by piece, finish, stone or collection — try “hoops”, “kundan”, “CZ” or “bridal”."
        />
      </div>
    );
  }

  const [result, facets, collections, wishlisted] = await Promise.all([
    listProducts(filters),
    getShopFacets(),
    getAllCollections(),
    getWishlistedProductIds(),
  ]);

  return (
    <div className="container-site py-12 md:py-16">
      <PageHeader
        eyebrow="Search"
        title={`“${filters.search}”`}
        description={
          result.total
            ? `${result.total} ${result.total === 1 ? "piece" : "pieces"} matched your search.`
            : "Nothing matched that search."
        }
        crumbs={[{ label: "Search" }]}
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
        basePath="/search"
        searchParams={params}
        wishlisted={wishlisted}
        emptyTitle="No pieces matched"
        emptyBody="Try a shorter search — a finish, a stone, or the kind of piece you have in mind."
      />
    </div>
  );
}
