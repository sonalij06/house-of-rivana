import { describe, expect, it } from "vitest";
import {
  calculateDiscount,
  calculateShipping,
  calculateTax,
  priceCart,
  validateCouponWindow,
} from "@/lib/pricing";

const settings = {
  freeShippingThresholdPaise: 250_000,
  flatShippingRatePaise: 9_900,
  gstBasisPoints: 300,
  gstInclusive: true,
};

describe("priceCart", () => {
  it("sums lines and applies flat shipping under the free threshold", () => {
    const result = priceCart({
      lines: [
        { variantId: "a", unitPricePaise: 100_000, quantity: 1 },
        { variantId: "b", unitPricePaise: 50_000, quantity: 2 },
      ],
      settings,
    });

    expect(result.subtotalPaise).toBe(200_000);
    expect(result.shippingPaise).toBe(9_900);
    expect(result.grandTotalPaise).toBe(209_900);
    expect(result.itemCount).toBe(3);
  });

  it("waives shipping at the free threshold", () => {
    const result = priceCart({
      lines: [{ variantId: "a", unitPricePaise: 250_000, quantity: 1 }],
      settings,
    });
    expect(result.shippingPaise).toBe(0);
    expect(result.grandTotalPaise).toBe(250_000);
  });

  it("applies a percent coupon with a max cap", () => {
    const result = priceCart({
      lines: [{ variantId: "a", unitPricePaise: 200_000, quantity: 1 }],
      coupon: {
        code: "RIVANA20",
        type: "PERCENT",
        value: 20,
        minSubtotalPaise: 0,
        maxDiscountPaise: 25_000,
      },
      settings,
    });
    expect(result.discountPaise).toBe(25_000);
    expect(result.appliedCouponCode).toBe("RIVANA20");
  });

  it("applies FREE_SHIPPING coupons without reducing the goods total", () => {
    const result = priceCart({
      lines: [{ variantId: "a", unitPricePaise: 100_000, quantity: 1 }],
      coupon: {
        code: "SHIPFREE",
        type: "FREE_SHIPPING",
        value: 0,
        minSubtotalPaise: 0,
      },
      settings,
    });
    expect(result.discountPaise).toBe(0);
    expect(result.shippingPaise).toBe(0);
    expect(result.appliedCouponCode).toBe("SHIPFREE");
  });

  it("backs GST out of inclusive totals", () => {
    const tax = calculateTax(103_000, settings);
    // 3% inclusive of 103000 ≈ 3000
    expect(tax).toBe(3000);
  });
});

describe("calculateDiscount", () => {
  it("never discounts below the subtotal", () => {
    expect(
      calculateDiscount(10_000, {
        code: "BIG",
        type: "FIXED",
        value: 50_000,
        minSubtotalPaise: 0,
      }),
    ).toBe(10_000);
  });

  it("returns zero when the minimum subtotal is not met", () => {
    expect(
      calculateDiscount(5_000, {
        code: "MIN",
        type: "PERCENT",
        value: 10,
        minSubtotalPaise: 10_000,
      }),
    ).toBe(0);
  });
});

describe("calculateShipping", () => {
  it("is zero for empty carts", () => {
    expect(calculateShipping(0, settings, null)).toBe(0);
  });
});

describe("validateCouponWindow", () => {
  it("rejects inactive and expired coupons", () => {
    expect(
      validateCouponWindow(
        {
          code: "OLD",
          isActive: false,
          usedCount: 0,
          minSubtotalPaise: 0,
        },
        100_000,
      )?.kind,
    ).toBe("INACTIVE");

    expect(
      validateCouponWindow(
        {
          code: "OLD",
          isActive: true,
          endsAt: new Date("2020-01-01"),
          usedCount: 0,
          minSubtotalPaise: 0,
        },
        100_000,
        new Date("2026-01-01"),
      )?.kind,
    ).toBe("EXPIRED");
  });
});
