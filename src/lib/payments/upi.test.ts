import { describe, expect, it } from "vitest";
import { buildUpiUri, isValidUtr, isValidVpa, normaliseUtr } from "@/lib/payments/upi";

describe("UPI helpers", () => {
  it("accepts typical VPAs", () => {
    expect(isValidVpa("houseofrivana@upi")).toBe(true);
    expect(isValidVpa("bad")).toBe(false);
  });

  it("normalises and validates 12-digit UTRs", () => {
    expect(normaliseUtr("1234 5678 9012")).toBe("123456789012");
    expect(isValidUtr("123456789012")).toBe(true);
    expect(isValidUtr("12345")).toBe(false);
  });

  it("builds a pay intent with two-decimal amount", () => {
    const uri = buildUpiUri({
      payeeVpa: "houseofrivana@upi",
      payeeName: "House of Rivana",
      amountPaise: 259_900,
      note: "HOR-2026-0001",
      reference: "HOR-2026-0001",
    });
    expect(uri.startsWith("upi://pay?")).toBe(true);
    expect(uri).toContain("am=2599.00");
    expect(uri).toContain("pa=houseofrivana%40upi");
  });
});
