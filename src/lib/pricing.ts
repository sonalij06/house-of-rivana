/**
 * Pure pricing engine. No database, no I/O — so it is unit-testable and can be
 * called identically from the cart page, the checkout action and the seed script.
 *
 * Every amount is integer paise. The only rounding happens here, once per field.
 */

export type CouponType = "PERCENT" | "FIXED" | "FREE_SHIPPING";

export type PricingLine = {
  variantId: string;
  unitPricePaise: number;
  quantity: number;
  /** Used to scope collection-restricted coupons. */
  collectionSlugs?: string[];
};

export type PricingCoupon = {
  code: string;
  type: CouponType;
  /** PERCENT: whole percent (15 = 15%). FIXED: paise. FREE_SHIPPING: unused. */
  value: number;
  minSubtotalPaise: number;
  maxDiscountPaise?: number | null;
};

export type PricingSettings = {
  freeShippingThresholdPaise: number;
  flatShippingRatePaise: number;
  /** Basis points: 3% is 300. */
  gstBasisPoints: number;
  /** Indian fashion jewellery pricing is quoted GST-inclusive. */
  gstInclusive: boolean;
};

export type PriceBreakdown = {
  itemCount: number;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  grandTotalPaise: number;
  /** Rupees still needed to unlock free shipping, or 0 when already free. */
  freeShippingRemainingPaise: number;
  appliedCouponCode: string | null;
  couponError: CouponError | null;
};

export type CouponError =
  | { kind: "NOT_FOUND"; message: string }
  | { kind: "INACTIVE"; message: string }
  | { kind: "EXPIRED"; message: string }
  | { kind: "NOT_STARTED"; message: string }
  | { kind: "MIN_SUBTOTAL"; message: string; minSubtotalPaise: number }
  | { kind: "USAGE_LIMIT"; message: string }
  | { kind: "ALREADY_USED"; message: string };

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  freeShippingThresholdPaise: 250_000,
  flatShippingRatePaise: 9_900,
  gstBasisPoints: 300,
  gstInclusive: true,
};

export function lineTotal(line: PricingLine) {
  return line.unitPricePaise * line.quantity;
}

export function calculateSubtotal(lines: PricingLine[]) {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function calculateDiscount(
  subtotalPaise: number,
  coupon: PricingCoupon | null,
): number {
  if (!coupon) return 0;
  if (subtotalPaise < coupon.minSubtotalPaise) return 0;

  switch (coupon.type) {
    case "PERCENT": {
      const raw = Math.round((subtotalPaise * coupon.value) / 100);
      const capped = coupon.maxDiscountPaise
        ? Math.min(raw, coupon.maxDiscountPaise)
        : raw;
      return Math.min(capped, subtotalPaise);
    }
    case "FIXED":
      return Math.min(coupon.value, subtotalPaise);
    case "FREE_SHIPPING":
      return 0;
    default:
      return 0;
  }
}

export function calculateShipping(
  discountedSubtotalPaise: number,
  settings: PricingSettings,
  coupon: PricingCoupon | null,
): number {
  if (discountedSubtotalPaise <= 0) return 0;
  if (coupon?.type === "FREE_SHIPPING") return 0;
  if (discountedSubtotalPaise >= settings.freeShippingThresholdPaise) return 0;
  return settings.flatShippingRatePaise;
}

/**
 * GST-inclusive is the norm for Indian jewellery: the listed price already
 * contains tax, so we back it out for the invoice rather than adding on top.
 */
export function calculateTax(
  taxableBasePaise: number,
  settings: PricingSettings,
): number {
  if (taxableBasePaise <= 0 || settings.gstBasisPoints <= 0) return 0;
  const rate = settings.gstBasisPoints / 10_000;
  return settings.gstInclusive
    ? Math.round(taxableBasePaise - taxableBasePaise / (1 + rate))
    : Math.round(taxableBasePaise * rate);
}

export function priceCart(input: {
  lines: PricingLine[];
  coupon?: PricingCoupon | null;
  couponError?: CouponError | null;
  settings?: PricingSettings;
}): PriceBreakdown {
  const settings = input.settings ?? DEFAULT_PRICING_SETTINGS;
  const coupon = input.couponError ? null : (input.coupon ?? null);

  const subtotalPaise = calculateSubtotal(input.lines);
  const itemCount = input.lines.reduce((n, l) => n + l.quantity, 0);
  const discountPaise = calculateDiscount(subtotalPaise, coupon);
  const discountedSubtotal = subtotalPaise - discountPaise;
  const shippingPaise = calculateShipping(discountedSubtotal, settings, coupon);

  const taxPaise = calculateTax(
    settings.gstInclusive ? discountedSubtotal : discountedSubtotal + shippingPaise,
    settings,
  );

  // With inclusive GST the tax is already inside the subtotal, so the grand total
  // is simply goods plus shipping. With exclusive GST it is added on.
  const grandTotalPaise = settings.gstInclusive
    ? discountedSubtotal + shippingPaise
    : discountedSubtotal + shippingPaise + taxPaise;

  const freeShippingRemainingPaise =
    shippingPaise === 0
      ? 0
      : Math.max(0, settings.freeShippingThresholdPaise - discountedSubtotal);

  return {
    itemCount,
    subtotalPaise,
    discountPaise,
    shippingPaise,
    taxPaise,
    grandTotalPaise,
    freeShippingRemainingPaise,
    appliedCouponCode: coupon && discountPaise > 0 ? coupon.code : coupon?.type === "FREE_SHIPPING" ? coupon.code : null,
    couponError: input.couponError ?? null,
  };
}

/** Validates the parts of a coupon that do not need a database lookup. */
export function validateCouponWindow(
  coupon: {
    code: string;
    isActive: boolean;
    startsAt?: Date | null;
    endsAt?: Date | null;
    usageLimit?: number | null;
    usedCount: number;
    minSubtotalPaise: number;
  },
  subtotalPaise: number,
  now = new Date(),
): CouponError | null {
  if (!coupon.isActive) {
    return { kind: "INACTIVE", message: `${coupon.code} is no longer active.` };
  }
  if (coupon.startsAt && coupon.startsAt > now) {
    return { kind: "NOT_STARTED", message: `${coupon.code} is not active yet.` };
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    return { kind: "EXPIRED", message: `${coupon.code} has expired.` };
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return {
      kind: "USAGE_LIMIT",
      message: `${coupon.code} has reached its redemption limit.`,
    };
  }
  if (subtotalPaise < coupon.minSubtotalPaise) {
    return {
      kind: "MIN_SUBTOTAL",
      message: `Add ${formatRupees(coupon.minSubtotalPaise - subtotalPaise)} more to use ${coupon.code}.`,
      minSubtotalPaise: coupon.minSubtotalPaise,
    };
  }
  return null;
}

function formatRupees(paise: number) {
  return `₹${Math.ceil(paise / 100).toLocaleString("en-IN")}`;
}
