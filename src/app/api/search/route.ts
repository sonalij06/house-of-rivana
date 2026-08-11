import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { productSearchClauses } from "@/lib/search-query";

/** Typeahead for the header overlay. Kept intentionally small and cache-free. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 60) {
    return NextResponse.json({ results: [] });
  }

  const clauses = productSearchClauses(query, { includeDescription: false });
  if (!clauses.length) {
    return NextResponse.json({ results: [] });
  }

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      OR: clauses,
    },
    orderBy: [{ isBestseller: "desc" }, { ratingCount: "desc" }],
    take: 6,
    select: {
      slug: true,
      name: true,
      basePricePaise: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      collections: {
        take: 1,
        select: { collection: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({
    results: products.map((p) => ({
      slug: p.slug,
      name: p.name,
      pricePaise: p.basePricePaise,
      imageUrl: p.images[0]?.url ?? null,
      collection: p.collections[0]?.collection.name ?? null,
    })),
  });
}
