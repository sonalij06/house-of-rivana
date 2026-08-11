import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductGrid } from "@/components/product/product-grid";
import { Pagination } from "@/components/shop/pagination";
import {
  ActiveFilterChips,
  FilterPanel,
  MobileFilterButton,
  SortSelect,
} from "@/components/shop/filter-panel";
import type { ShopFacets, ShopFilters } from "@/lib/catalog-types";
import type { ProductCardData } from "@/lib/product";
import type { RawSearchParams } from "@/lib/shop-params";

type Collection = { slug: string; name: string; count: number };

/**
 * Shared results layout for /shop, /collections/[slug] and /search — sidebar,
 * toolbar, grid, pagination. Only the heading above it differs per route.
 */
export function CatalogView({
  products,
  total,
  page,
  pageCount,
  filters,
  facets,
  collections,
  basePath,
  searchParams,
  wishlisted,
  showCollectionFilter = true,
  emptyTitle = "Nothing matches those filters",
  emptyBody = "Try widening the price range or clearing a filter — new pieces arrive every few weeks.",
}: {
  products: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
  filters: ShopFilters;
  facets: ShopFacets;
  collections: Collection[];
  basePath: string;
  searchParams: RawSearchParams;
  wishlisted?: Set<string>;
  showCollectionFilter?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[15rem_1fr] lg:gap-14">
      <aside className="hidden lg:block">
        <div className="sticky top-28">
          <FilterPanel
            filters={filters}
            facets={facets}
            collections={collections}
            showCollections={showCollectionFilter}
          />
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
          <div className="flex items-center gap-3">
            <MobileFilterButton
              filters={filters}
              facets={facets}
              collections={collections}
              showCollections={showCollectionFilter}
            />
            <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-muted-light">
              {total} {total === 1 ? "piece" : "pieces"}
            </p>
          </div>
          <SortSelect sort={filters.sort ?? "featured"} />
        </div>

        <div className="mt-5">
          <ActiveFilterChips filters={filters} />
        </div>

        {products.length ? (
          <>
            <ProductGrid
              products={products}
              wishlisted={wishlisted}
              columns={3}
              priorityCount={3}
              className="mt-8"
            />
            <Pagination
              page={page}
              pageCount={pageCount}
              basePath={basePath}
              searchParams={searchParams}
            />
          </>
        ) : (
          <EmptyState
            className="mt-14"
            title={emptyTitle}
            description={emptyBody}
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/shop">Browse everything</Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
