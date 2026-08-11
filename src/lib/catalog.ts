import { unstable_cache } from "next/cache";
import { prisma, type Prisma } from "@/lib/db";
import { PRODUCT_CARD_SELECT, type ProductCardData } from "@/lib/product";

export const CATALOG_TAG = "catalog";

export {
  PRODUCT_CARD_SELECT,
  availableStock,
  metalLabel,
  productInStock,
} from "@/lib/product";
export type { ProductCardData } from "@/lib/product";

import type { ShopFacets, ShopFilters, SortKey } from "@/lib/catalog-types";
import { productSearchClauses } from "@/lib/search-query";

export type { ShopFacets, ShopFilters, SortKey } from "@/lib/catalog-types";

function orderByFor(sort: SortKey = "featured"): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ publishedAt: "desc" }, { createdAt: "desc" }];
    case "price-asc":
      return [{ basePricePaise: "asc" }];
    case "price-desc":
      return [{ basePricePaise: "desc" }];
    case "bestselling":
      return [{ soldCount: "desc" }, { ratingCount: "desc" }];
    case "rating":
      return [{ ratingAverage: "desc" }, { ratingCount: "desc" }];
    default:
      return [
        { isFeatured: "desc" },
        { isBestseller: "desc" },
        { publishedAt: "desc" },
      ];
  }
}

function whereFor(filters: ShopFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
  const and: Prisma.ProductWhereInput[] = [];

  if (filters.collection) {
    and.push({
      collections: { some: { collection: { slug: filters.collection } } },
    });
  }
  if (filters.metals?.length) {
    and.push({
      OR: [
        { metal: { in: filters.metals as Prisma.EnumMetalTypeFilter["in"] } },
        {
          variants: {
            some: {
              isActive: true,
              optionMetal: { in: filters.metals as Prisma.EnumMetalTypeFilter["in"] },
            },
          },
        },
      ],
    });
  }
  if (filters.gemstone) {
    and.push({ gemstone: { contains: filters.gemstone, mode: "insensitive" } });
  }
  if (filters.minPaise != null) {
    and.push({ basePricePaise: { gte: filters.minPaise } });
  }
  if (filters.maxPaise != null) {
    and.push({ basePricePaise: { lte: filters.maxPaise } });
  }
  if (filters.inStockOnly) {
    and.push({ variants: { some: { isActive: true, stockQty: { gt: 0 } } } });
  }
  if (filters.onSaleOnly) {
    and.push({ compareAtPaise: { not: null } });
  }
  if (filters.search) {
    const clauses = productSearchClauses(filters.search);
    if (clauses.length) and.push({ OR: clauses });
  }

  if (and.length) where.AND = and;
  return where;
}

export async function listProducts(filters: ShopFilters = {}) {
  const perPage = Math.min(filters.perPage ?? 12, 48);
  const page = Math.max(1, filters.page ?? 1);
  const where = whereFor(filters);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: orderByFor(filters.sort),
      select: PRODUCT_CARD_SELECT,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: { in: ["ACTIVE", "DRAFT"] } },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      collections: {
        include: { collection: { select: { slug: true, name: true } } },
      },
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });
}

export async function getRelatedProducts(
  productId: string,
  collectionSlugs: string[],
  take = 4,
) {
  return prisma.product.findMany({
    where: {
      status: "ACTIVE",
      id: { not: productId },
      ...(collectionSlugs.length
        ? { collections: { some: { collection: { slug: { in: collectionSlugs } } } } }
        : {}),
    },
    orderBy: [{ isBestseller: "desc" }, { ratingCount: "desc" }],
    take,
    select: PRODUCT_CARD_SELECT,
  });
}

export const getFeaturedCollections = unstable_cache(
  async () =>
    prisma.collection.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    }),
  ["featured-collections"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);

export const getAllCollections = unstable_cache(
  async () =>
    prisma.collection.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    }),
  ["all-collections"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);

export async function getCollectionBySlug(slug: string) {
  return prisma.collection.findFirst({
    where: { slug, isActive: true },
  });
}

export const getHeroSlides = unstable_cache(
  async () =>
    prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ["hero-slides"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);

export async function getShowcaseProducts() {
  const [featured, newArrivals, bestsellers] = await Promise.all([
    prisma.product.findMany({
      where: { status: "ACTIVE", isFeatured: true },
      orderBy: { publishedAt: "desc" },
      take: 8,
      select: PRODUCT_CARD_SELECT,
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE", isNewArrival: true },
      orderBy: { publishedAt: "desc" },
      take: 4,
      select: PRODUCT_CARD_SELECT,
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE", isBestseller: true },
      orderBy: { soldCount: "desc" },
      take: 4,
      select: PRODUCT_CARD_SELECT,
    }),
  ]);
  return { featured, newArrivals, bestsellers };
}

/** Facet values for the shop sidebar, derived from what is actually published. */
export async function getShopFacets(): Promise<ShopFacets> {
  const [metals, priceRange, gemstones] = await Promise.all([
    prisma.product.groupBy({
      by: ["metal"],
      where: { status: "ACTIVE" },
      _count: { metal: true },
    }),
    prisma.product.aggregate({
      where: { status: "ACTIVE" },
      _min: { basePricePaise: true },
      _max: { basePricePaise: true },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE", gemstone: { not: null } },
      select: { gemstone: true },
      distinct: ["gemstone"],
    }),
  ]);

  return {
    metals: metals.map((m) => ({ value: m.metal, count: m._count.metal })),
    minPaise: priceRange._min.basePricePaise ?? 0,
    maxPaise: priceRange._max.basePricePaise ?? 1_000_000,
    // Products list gemstones as a comma-separated string; the facet only wants
    // the primary stone, and distinct rows still collapse to duplicates here.
    gemstones: [
      ...new Set(
        gemstones
          .map((g) => g.gemstone?.split(",")[0]?.trim())
          .filter((g): g is string => Boolean(g)),
      ),
    ].slice(0, 8),
  };
}

export async function getProductsByIds(ids: string[]) {
  if (ids.length === 0) return [] as ProductCardData[];
  return prisma.product.findMany({
    where: { id: { in: ids } },
    select: PRODUCT_CARD_SELECT,
  });
}
