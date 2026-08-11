import { describe, expect, it } from "vitest";
import { editDistance, expandSearchTerms } from "@/lib/search-query";

describe("editDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(editDistance("earring", "earring")).toBe(0);
  });

  it("counts a single insertion", () => {
    expect(editDistance("earing", "earring")).toBe(1);
  });
});

describe("expandSearchTerms", () => {
  it("corrects earing to earring", () => {
    const terms = expandSearchTerms("earing");
    expect(terms).toContain("earing");
    expect(terms.some((t) => t.includes("earring"))).toBe(true);
  });

  it("corrects neklace to necklace", () => {
    const terms = expandSearchTerms("neklace");
    expect(terms.some((t) => t.includes("necklace"))).toBe(true);
  });

  it("corrects bracelete to bracelet", () => {
    const terms = expandSearchTerms("bracelete");
    expect(terms.some((t) => t.includes("bracelet"))).toBe(true);
  });

  it("fuzzy-matches solitare to solitaire", () => {
    const terms = expandSearchTerms("solitare");
    expect(terms.some((t) => t.includes("solitaire"))).toBe(true);
  });

  it("keeps the original query", () => {
    expect(expandSearchTerms("Rivana hoop")).toContain("Rivana hoop");
  });

  it("returns empty for blank input", () => {
    expect(expandSearchTerms("   ")).toEqual([]);
  });
});
