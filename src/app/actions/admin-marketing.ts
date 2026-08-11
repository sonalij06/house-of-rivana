"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { failField, failWrite, failZod } from "@/lib/action-errors";
import { assertStaff, recordAudit } from "@/lib/session";
import type { ActionResult } from "@/app/actions/cart";

const couponSchema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .trim()
      .min(3, "A code needs at least three characters.")
      .max(24)
      .regex(/^[A-Z0-9]+$/, "Capitals and digits only — no spaces."),
    description: z.string().trim().max(160).optional(),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
    value: z.number().min(0).max(10_000_000),
    minSubtotalRupees: z.number().min(0).max(10_000_000),
    maxDiscountRupees: z.number().min(0).max(10_000_000).optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    usageLimit: z.number().int().min(0).max(1_000_000).optional(),
    usageLimitPerUser: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean(),
  })
  .refine((data) => data.type === "FREE_SHIPPING" || data.value > 0, {
    message: "Set the discount amount.",
    path: ["value"],
  })
  .refine((data) => data.type !== "PERCENT" || data.value <= 90, {
    message: "Cap percentage coupons at 90%.",
    path: ["value"],
  })
  .refine(
    (data) =>
      !data.startsAt ||
      !data.endsAt ||
      new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime(),
    { message: "The end date has to come after the start date.", path: ["endsAt"] },
  );

export async function saveCoupon(input: unknown): Promise<ActionResult> {
  const actor = await assertStaff();

  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return failZod(parsed.error);
  const data = parsed.data;

  const clash = await prisma.coupon.findFirst({
    where: { code: data.code, ...(data.id ? { id: { not: data.id } } : {}) },
    select: { id: true },
  });
  if (clash) return failField("code", `${data.code} already exists.`);

  const payload = {
    code: data.code,
    description: data.description || null,
    type: data.type,
    // PERCENT stores whole percent, FIXED stores paise, FREE_SHIPPING ignores it.
    value:
      data.type === "FREE_SHIPPING"
        ? 0
        : data.type === "PERCENT"
          ? Math.round(data.value)
          : Math.round(data.value * 100),
    minSubtotalPaise: Math.round(data.minSubtotalRupees * 100),
    maxDiscountPaise: data.maxDiscountRupees
      ? Math.round(data.maxDiscountRupees * 100)
      : null,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
    usageLimit: data.usageLimit && data.usageLimit > 0 ? data.usageLimit : null,
    usageLimitPerUser:
      data.usageLimitPerUser && data.usageLimitPerUser > 0 ? data.usageLimitPerUser : null,
    isActive: data.isActive,
  };

  try {
    const coupon = data.id
      ? await prisma.coupon.update({ where: { id: data.id }, data: payload })
      : await prisma.coupon.create({ data: payload });

    await recordAudit({
      actor,
      action: data.id ? "coupon.update" : "coupon.create",
      entity: "Coupon",
      entityId: coupon.id,
      after: coupon,
    });

    revalidatePath("/admin/coupons");
    return { ok: true };
  } catch (err) {
    return failWrite(err, {
      code: `${data.code} already exists.`,
    });
  }
}

export async function toggleCoupon(couponId: string): Promise<ActionResult> {
  const actor = await assertStaff();

  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    select: { isActive: true, code: true },
  });
  if (!coupon) return { ok: false, error: "That coupon no longer exists." };

  await prisma.coupon.update({
    where: { id: couponId },
    data: { isActive: !coupon.isActive },
  });
  await recordAudit({
    actor,
    action: coupon.isActive ? "coupon.disable" : "coupon.enable",
    entity: "Coupon",
    entityId: couponId,
    after: { code: coupon.code, isActive: !coupon.isActive },
  });

  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function deleteCoupon(couponId: string): Promise<ActionResult> {
  const actor = await assertStaff();

  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    select: { code: true, _count: { select: { redemptions: true } } },
  });
  if (!coupon) return { ok: false, error: "That coupon no longer exists." };

  // A redeemed coupon is part of order history, so it is retired rather than removed.
  if (coupon._count.redemptions > 0) {
    await prisma.coupon.update({ where: { id: couponId }, data: { isActive: false } });
    await recordAudit({
      actor,
      action: "coupon.disable",
      entity: "Coupon",
      entityId: couponId,
      after: { code: coupon.code, reason: "has redemptions" },
    });
    revalidatePath("/admin/coupons");
    return { ok: false, error: `${coupon.code} has been used, so it was disabled instead.` };
  }

  await prisma.coupon.delete({ where: { id: couponId } });
  await recordAudit({
    actor,
    action: "coupon.delete",
    entity: "Coupon",
    entityId: couponId,
    before: coupon,
  });

  revalidatePath("/admin/coupons");
  return { ok: true };
}

const moderationSchema = z.object({
  reviewId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(500).optional(),
});

/** Approving recomputes the product's aggregate so the PDP stays in sync. */
export async function moderateReview(input: unknown): Promise<ActionResult> {
  const actor = await assertStaff();

  const parsed = moderationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { reviewId, action, note } = parsed.data;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, productId: true, status: true, product: { select: { slug: true } } },
  });
  if (!review) return { ok: false, error: "That review no longer exists." };

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      moderationNote: note || null,
    },
  });

  await recalculateProductRating(review.productId);

  await recordAudit({
    actor,
    action: action === "APPROVE" ? "review.approve" : "review.reject",
    entity: "Review",
    entityId: reviewId,
    before: { status: review.status },
    after: { status: action === "APPROVE" ? "APPROVED" : "REJECTED" },
  });

  revalidatePath("/admin/reviews");
  revalidatePath(`/product/${review.product.slug}`);
  return { ok: true };
}

export async function deleteReview(reviewId: string): Promise<ActionResult> {
  const actor = await assertStaff();

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { productId: true, product: { select: { slug: true } } },
  });
  if (!review) return { ok: false, error: "That review is already gone." };

  await prisma.review.delete({ where: { id: reviewId } });
  await recalculateProductRating(review.productId);

  await recordAudit({
    actor,
    action: "review.delete",
    entity: "Review",
    entityId: reviewId,
  });

  revalidatePath("/admin/reviews");
  revalidatePath(`/product/${review.product.slug}`);
  return { ok: true };
}

export async function recalculateProductRating(productId: string) {
  const aggregate = await prisma.review.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAverage: Number((aggregate._avg.rating ?? 0).toFixed(2)),
      ratingCount: aggregate._count._all,
    },
  });
}
