import type { Prisma } from "@/generated/prisma/client";

/**
 * Client-safe product helpers and shapes.
 *
 * This file must never import src/lib/db — client components render product
 * cards, and pulling the Prisma driver adapter into the browser bundle breaks
 * the build with Node-only module errors. Anything needing a query belongs in
 * src/lib/catalog.ts instead.
 */

export const PRODUCT_CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  basePricePaise: true,
  compareAtPaise: true,
  metal: true,
  gemstone: true,
  isFeatured: true,
  isBestseller: true,
  isNewArrival: true,
  madeToOrderDays: true,
  ratingAverage: true,
  ratingCount: true,
  images: {
    orderBy: { sortOrder: "asc" },
    take: 2,
    select: { url: true, alt: true, blurDataUrl: true },
  },
  variants: {
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, stockQty: true, reservedQty: true, pricePaise: true },
  },
  collections: {
    select: { collection: { select: { slug: true, name: true } } },
  },
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_CARD_SELECT;
}>;

/** Stock that can actually be sold right now, after checkout reservations. */
export function availableStock(variant: {
  stockQty: number;
  reservedQty: number;
}) {
  return Math.max(0, variant.stockQty - variant.reservedQty);
}

export function productInStock(product: {
  variants: { stockQty: number; reservedQty: number }[];
}) {
  return product.variants.some((v) => availableStock(v) > 0);
}

/** Finish labels for fashion / artificial jewellery (not solid precious metal). */
export const METAL_LABELS: Record<string, string> = {
  YELLOW_GOLD: "Gold-plated",
  ROSE_GOLD: "Rose gold-plated",
  WHITE_GOLD: "Silver-tone",
  STERLING_SILVER: "Silver-plated",
  PLATINUM: "Platinum-tone",
  GOLD_VERMEIL: "High-polish gold tone",
  BRASS: "Brass",
};

export function metalLabel(metal: string) {
  return METAL_LABELS[metal] ?? metal;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAYMENT_UNDER_REVIEW: "Verifying payment",
  CONFIRMED: "Confirmed",
  PROCESSING: "Being prepared",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
};

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function orderStatusTone(
  status: string,
): "neutral" | "gold" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "PENDING_PAYMENT":
      return "warning";
    case "PAYMENT_UNDER_REVIEW":
      return "info";
    case "CONFIRMED":
    case "PROCESSING":
    case "PACKED":
      return "gold";
    case "SHIPPED":
    case "OUT_FOR_DELIVERY":
      return "info";
    case "DELIVERED":
      return "success";
    case "CANCELLED":
    case "REFUNDED":
    case "RETURNED":
      return "danger";
    case "RETURN_REQUESTED":
      return "warning";
    default:
      return "neutral";
  }
}
