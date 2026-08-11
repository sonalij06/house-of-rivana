"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "@/app/actions/cart";

export async function toggleWishlist(
  productId: string,
): Promise<ActionResult<{ saved: boolean }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Sign in to save pieces to your wishlist." };
  }

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/account/wishlist");
    return { ok: true, data: { saved: false } };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "That piece no longer exists." };

  await prisma.wishlistItem.create({ data: { userId: user.id, productId } });
  revalidatePath("/account/wishlist");
  return { ok: true, data: { saved: true } };
}
