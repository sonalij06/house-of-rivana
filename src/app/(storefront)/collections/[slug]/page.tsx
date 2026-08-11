import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/shop/catalog-view";
import { CollectionBanner } from "@/components/shop/collection-banner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import {
  getAllCollections,
  getCollectionBySlug,
  getShopFacets,
  listProducts,
} from "@/lib/catalog";
import { parseShopParams, type RawSearchParams } from "@/lib/shop-params";
import { getWishlistedProductIds } from "@/lib/wishlist";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: "Collection not found" };

  const title = collection.metaTitle ?? collection.name;
  const description =
    collection.metaDescription ??
    collection.description ??
    `Shop the ${collection.name} collection from House of Rivana.`;

  return {
    title,
    description,
    alternates: { canonical: `/collections/${collection.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: collection.heroImage ? [{ url: collection.heroImage }] : undefined,
    },
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ slug }, rawParams] = await Promise.all([params, searchParams]);
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  // The collection is fixed by the route, so the sidebar drops that facet and
  // the query always scopes to this slug regardless of the URL.
  const filters = { ...parseShopParams(rawParams), collection: slug };

  const [result, facets, collections, wishlisted] = await Promise.all([
    listProducts(filters),
    getShopFacets(),
    getAllCollections(),
    getWishlistedProductIds(),
  ]);

  return (
    <div>
      <CollectionBanner
        name={collection.name}
        subtitle={collection.subtitle}
        description={collection.description}
        heroImage={collection.heroImage}
        productCount={result.total}
      />

      <div className="container-site pb-16 pt-8">
        <Breadcrumbs
          items={[{ label: "Collections", href: "/collections" }, { label: collection.name }]}
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
          basePath={`/collections/${slug}`}
          searchParams={rawParams}
          wishlisted={wishlisted}
          showCollectionFilter={false}
          emptyTitle="This edit is between drops"
          emptyBody="Nothing in this collection matches those filters right now. Clear them, or browse the rest of the catalogue."
        />
      </div>
    </div>
  );
}
