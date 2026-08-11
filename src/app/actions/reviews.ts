"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/cart";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { uploadProductImage } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";

const reviewSchema = z.object({
  productId: z.string().min(1),
  orderId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(80).optional(),
  body: z.string().trim().min(20).max(2000),
});

/**
 * Verified-purchase reviews only: the order must belong to the user, include
 * the product, and be delivered. Photos go to the public product bucket under
 * a reviews/ prefix and enter the moderation queue as PENDING.
 */
export async function submitReview(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to leave a review." };

  const limited = await checkRateLimit(`review:${user.id}`, {
    max: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    return { ok: false, error: "Too many review submissions. Try again later." };
  }

  const parsed = reviewSchema.safeParse({
    productId: formData.get("productId"),
    orderId: formData.get("orderId"),
    rating: formData.get("rating"),
    title: formData.get("title") || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check your review.",
    };
  }

  const { productId, orderId, rating, title, body } = parsed.data;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: user.id,
      status: "DELIVERED",
      items: { some: { productId } },
    },
    select: { id: true, orderNumber: true },
  });
  if (!order) {
    return {
      ok: false,
      error: "You can only review pieces from your delivered orders.",
    };
  }

  const existing = await prisma.review.findFirst({
    where: { userId: user.id, productId, orderId },
  });
  if (existing) {
    return { ok: false, error: "You have already reviewed this piece for that order." };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true, name: true },
  });
  if (!product) return { ok: false, error: "That piece no longer exists." };

  const imageUrls: string[] = [];
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const uploaded = await uploadProductImage(`reviews/${product.slug}`, photo);
    if (!uploaded.ok) return { ok: false, error: uploaded.error };
    if (uploaded.publicUrl) imageUrls.push(uploaded.publicUrl);
  }

  const review = await prisma.review.create({
    data: {
      productId,
      userId: user.id,
      orderId: order.id,
      authorName: user.name,
      rating,
      title: title || null,
      body,
      imageUrls,
      status: "PENDING",
      isVerifiedPurchase: true,
    },
  });

  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/account/reviews");
  revalidatePath("/admin/reviews");

  return { ok: true, data: { id: review.id } };
}
