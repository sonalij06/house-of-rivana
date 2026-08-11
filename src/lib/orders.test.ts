import { describe, expect, it } from "vitest";
import { canTransition, nextStatuses } from "@/lib/orders";

describe("order status machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("PENDING_PAYMENT", "PAYMENT_UNDER_REVIEW")).toBe(true);
    expect(canTransition("PAYMENT_UNDER_REVIEW", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "PACKED")).toBe(true);
    expect(canTransition("PACKED", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("blocks illegal jumps", () => {
    expect(canTransition("PENDING_PAYMENT", "DELIVERED")).toBe(false);
    expect(canTransition("DELIVERED", "CONFIRMED")).toBe(false);
    expect(canTransition("REFUNDED", "CONFIRMED")).toBe(false);
  });

  it("lists next statuses for admin controls", () => {
    expect(nextStatuses("PACKED")).toContain("SHIPPED");
    expect(nextStatuses("REFUNDED")).toEqual([]);
  });
});
