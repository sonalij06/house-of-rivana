import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { generateCartToken } from "@/lib/ids";
import {
  priceCart,
  validateCouponWindow,
  type CouponError,
  type PriceBreakdown,
} from "@/lib/pricing";
import { getCurrentUser } from "@/lib/session";
import { getPricingSettings } from "@/lib/settings";

export const CART_COOKIE = "rivana_cart";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 60;

export type CartLine = {
  itemId: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string;
  sku: string;
  imageUrl: string | null;
  imageAlt: string;
  unitPricePaise: number;
  compareAtPaise: number | null;
  quantity: number;
  availableStock: number;
  lineTotalPaise: number;
  madeToOrderDays: number | null;
};

export type CartSnapshot = {
  cartId: string | null;
  lines: CartLine[];
  breakdown: PriceBreakdown;
  couponCode: string | null;
  /** Lines whose stock dropped below the requested quantity while in the cart. */
  issues: { variantId: string; message: string }[];
};

const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              madeToOrderDays: true,
              status: true,
              images: {
                orderBy: { sortOrder: "asc" as const },
                take: 1,
                select: { url: true, alt: true },
              },
            },
          },
        },
      },
    },
  },
};

/** Read-only lookup: never creates a cart, so it is safe in server components. */
export async function findCart() {
  const user = await getCurrentUser();
  const token = (await cookies()).get(CART_COOKIE)?.value;

  if (user) {
    const owned = await prisma.cart.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: CART_INCLUDE,
    });
    if (owned) return owned;
  }
  if (token) {
    return prisma.cart.findUnique({
      where: { sessionToken: token },
      include: CART_INCLUDE,
    });
  }
  return null;
}

/**
 * Creates the cart if needed. Only call from server actions — it writes a cookie,
 * which is not permitted while rendering.
 */
export async function getOrCreateCart() {
  const existing = await findCart();
  if (existing) return existing;

  const user = await getCurrentUser();
  const jar = await cookies();
  let token = jar.get(CART_COOKIE)?.value;
  if (!token) {
    token = generateCartToken();
    jar.set(CART_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CART_COOKIE_MAX_AGE,
    });
  }

  return prisma.cart.create({
    data: { userId: user?.id ?? null, sessionToken: user ? null : token },
    include: CART_INCLUDE,
  });
}

/**
 * On sign-in the guest cart is folded into the account cart. Quantities are
 * summed and capped at available stock rather than overwritten, which is what
 * shoppers expect when they add on mobile then log in on desktop.
 */
export async function mergeGuestCartIntoUser(userId: string) {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return;

  const guestCart = await prisma.cart.findUnique({
    where: { sessionToken: token },
    include: { items: true },
  });
  if (!guestCart || guestCart.items.length === 0) {
    if (guestCart) {
      await prisma.cart.delete({ where: { id: guestCart.id } });
    }
    return;
  }

  const userCart = await prisma.cart.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  if (!userCart) {
    await prisma.cart.update({
      where: { id: guestCart.id },
      data: { userId, sessionToken: null },
    });
    return;
  }

  for (const item of guestCart.items) {
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
    });
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      select: { stockQty: true, reservedQty: true },
    });
    const cap = variant ? Math.max(0, variant.stockQty - variant.reservedQty) : 0;
    if (cap === 0) continue;

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: Math.min(cap, existing.quantity + item.quantity) },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: userCart.id,
          variantId: item.variantId,
          quantity: Math.min(cap, item.quantity),
        },
      });
    }
  }

  if (guestCart.couponCode && !userCart.couponCode) {
    await prisma.cart.update({
      where: { id: userCart.id },
      data: { couponCode: guestCart.couponCode },
    });
  }

  await prisma.cart.delete({ where: { id: guestCart.id } });
}

export const EMPTY_CART: CartSnapshot = {
  cartId: null,
  lines: [],
  breakdown: priceCart({ lines: [] }),
  couponCode: null,
  issues: [],
};

/**
 * Builds the priced cart. Prices always come from the variant row, never from
 * anything the client sent, so a tampered payload cannot change what is charged.
 */
export async function getCartSnapshot(): Promise<CartSnapshot> {
  const cart = await findCart();
  if (!cart) return EMPTY_CART;

  const settings = await getPricingSettings();
  const issues: CartSnapshot["issues"] = [];
  const lines: CartLine[] = [];

  for (const item of cart.items) {
    const { variant } = item;
    if (!variant.isActive || variant.product.status !== "ACTIVE") {
      issues.push({
        variantId: variant.id,
        message: `${variant.product.name} is no longer available and was removed.`,
      });
      continue;
    }

    const available = Math.max(0, variant.stockQty - variant.reservedQty);
    const quantity = Math.min(item.quantity, Math.max(available, 0));

    if (available === 0) {
      issues.push({
        variantId: variant.id,
        message: `${variant.product.name} (${variant.label}) has sold out.`,
      });
      continue;
    }
    if (quantity < item.quantity) {
      issues.push({
        variantId: variant.id,
        message: `Only ${available} left of ${variant.product.name} (${variant.label}).`,
      });
    }

    lines.push({
      itemId: item.id,
      variantId: variant.id,
      productId: variant.product.id,
      slug: variant.product.slug,
      name: variant.product.name,
      variantLabel: variant.label,
      sku: variant.sku,
      imageUrl: variant.product.images[0]?.url ?? null,
      imageAlt: variant.product.images[0]?.alt ?? variant.product.name,
      unitPricePaise: variant.pricePaise,
      compareAtPaise: variant.compareAtPaise,
      quantity,
      availableStock: available,
      lineTotalPaise: variant.pricePaise * quantity,
      madeToOrderDays: variant.product.madeToOrderDays,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotalPaise, 0);
  const { coupon, error } = await resolveCoupon(cart.couponCode, subtotal);

  return {
    cartId: cart.id,
    lines,
    couponCode: cart.couponCode,
    issues,
    breakdown: priceCart({
      lines: lines.map((l) => ({
        variantId: l.variantId,
        unitPricePaise: l.unitPricePaise,
        quantity: l.quantity,
      })),
      coupon,
      couponError: error,
      settings,
    }),
  };
}

export async function resolveCoupon(code: string | null, subtotalPaise: number) {
  if (!code) return { coupon: null, error: null as CouponError | null };

  const record = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!record) {
    return {
      coupon: null,
      error: { kind: "NOT_FOUND", message: `${code} is not a valid code.` } as CouponError,
    };
  }

  const windowError = validateCouponWindow(
    {
      code: record.code,
      isActive: record.isActive,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      usageLimit: record.usageLimit,
      usedCount: record.usedCount,
      minSubtotalPaise: record.minSubtotalPaise,
    },
    subtotalPaise,
  );
  if (windowError) return { coupon: null, error: windowError };

  // Per-user caps only apply once we know who is shopping.
  const user = await getCurrentUser();
  if (user && record.usageLimitPerUser != null) {
    const used = await prisma.couponRedemption.count({
      where: { couponId: record.id, userId: user.id },
    });
    if (used >= record.usageLimitPerUser) {
      return {
        coupon: null,
        error: {
          kind: "ALREADY_USED",
          message: `You have already used ${record.code}.`,
        } as CouponError,
      };
    }
  }

  return {
    coupon: {
      code: record.code,
      type: record.type,
      value: record.value,
      minSubtotalPaise: record.minSubtotalPaise,
      maxDiscountPaise: record.maxDiscountPaise,
    },
    error: null as CouponError | null,
  };
}

export async function getCartCount() {
  const cart = await findCart();
  if (!cart) return 0;
  return cart.items.reduce((n, i) => n + i.quantity, 0);
}
