import { cache } from "react";
import { prisma } from "@/lib/db";
import { PRODUCT_CARD_SELECT } from "@/lib/product";
import { getCurrentUser } from "@/lib/session";

/** Server-only helper so grids can render the saved state without an extra fetch. */
export const getWishlistedProductIds = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return new Set<string>();
  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    select: { productId: true },
  });
  return new Set(items.map((i) => i.productId));
});

export async function getWishlistProducts() {
  const user = await getCurrentUser();
  if (!user) return [];
  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { product: { select: PRODUCT_CARD_SELECT } },
  });
  return items
    .filter((i) => i.product)
    .map((i) => ({ addedAt: i.createdAt, product: i.product }));
}
