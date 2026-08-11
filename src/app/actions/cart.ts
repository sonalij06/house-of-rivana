"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateCart, findCart, resolveCoupon } from "@/lib/cart";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

function revalidateCart() {
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/", "layout");
}

const addSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
});

export async function addToCart(input: {
  variantId: string;
  quantity?: number;
}): Promise<ActionResult<{ count: number }>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return fail("That selection is not valid.");

  const variant = await prisma.productVariant.findUnique({
    where: { id: parsed.data.variantId },
    include: { product: { select: { name: true, status: true } } },
  });

  if (!variant || !variant.isActive || variant.product.status !== "ACTIVE") {
    return fail("That piece is no longer available.");
  }

  const available = Math.max(0, variant.stockQty - variant.reservedQty);
  if (available === 0) return fail(`${variant.product.name} has sold out.`);

  const cart = await getOrCreateCart();
  const existing = cart.items.find((i) => i.variantId === variant.id);
  const desired = (existing?.quantity ?? 0) + parsed.data.quantity;

  if (desired > available) {
    return fail(
      available === (existing?.quantity ?? 0)
        ? `You already have the last ${available} in your bag.`
        : `Only ${available} available.`,
    );
  }

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: desired },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, variantId: variant.id, quantity: parsed.data.quantity },
    });
  }
  await prisma.cart.update({
    where: { id: cart.id },
    data: { updatedAt: new Date() },
  });

  const refreshed = await prisma.cartItem.aggregate({
    where: { cartId: cart.id },
    _sum: { quantity: true },
  });

  revalidateCart();
  return { ok: true, data: { count: refreshed._sum.quantity ?? 0 } };
}

export async function updateCartItem(
  itemId: string,
  quantity: number,
): Promise<ActionResult> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10) {
    return fail("Choose a quantity between 1 and 10.");
  }

  const cart = await findCart();
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) return fail("That item is no longer in your bag.");

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    revalidateCart();
    return { ok: true };
  }

  const available = Math.max(0, item.variant.stockQty - item.variant.reservedQty);
  if (quantity > available) return fail(`Only ${available} available.`);

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  revalidateCart();
  return { ok: true };
}

export async function removeCartItem(itemId: string): Promise<ActionResult> {
  const cart = await findCart();
  const item = cart?.items.find((i) => i.id === itemId);
  if (!item) return { ok: true };

  await prisma.cartItem.delete({ where: { id: item.id } });
  revalidateCart();
  return { ok: true };
}

export async function clearCart(): Promise<ActionResult> {
  const cart = await findCart();
  if (!cart) return { ok: true };
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cart.update({
    where: { id: cart.id },
    data: { couponCode: null },
  });
  revalidateCart();
  return { ok: true };
}

export async function applyCoupon(codeInput: string): Promise<ActionResult<{ message: string }>> {
  const code = codeInput.trim().toUpperCase();
  if (!code) return fail("Enter a code.");
  if (code.length > 32) return fail("That code is too long.");

  const cart = await findCart();
  if (!cart || cart.items.length === 0) {
    return fail("Add something to your bag first.");
  }

  const subtotal = cart.items.reduce(
    (sum, i) => sum + i.variant.pricePaise * i.quantity,
    0,
  );
  const { coupon, error } = await resolveCoupon(code, subtotal);
  if (error) return fail(error.message);
  if (!coupon) return fail("That code is not valid.");

  await prisma.cart.update({
    where: { id: cart.id },
    data: { couponCode: coupon.code },
  });

  revalidateCart();
  return { ok: true, data: { message: `${coupon.code} applied.` } };
}

export async function removeCoupon(): Promise<ActionResult> {
  const cart = await findCart();
  if (!cart) return { ok: true };
  await prisma.cart.update({
    where: { id: cart.id },
    data: { couponCode: null },
  });
  revalidateCart();
  return { ok: true };
}
