import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { failField, failWrite, failZod } from "@/lib/action-errors";

describe("failZod", () => {
  it("maps each first path segment to its first message", () => {
    const schema = z.object({
      sku: z.string().min(3, "A SKU needs at least three characters."),
      label: z.string().min(1, "Give the variant a label."),
    });
    const parsed = schema.safeParse({ sku: "AB", label: "" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const result = failZod(parsed.error);
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.sku).toBe("A SKU needs at least three characters.");
    expect(result.fieldErrors?.label).toBe("Give the variant a label.");
    expect(result.error).toBe("A SKU needs at least three characters.");
  });
});

describe("failWrite", () => {
  it("maps unique constraint failures onto the matching field", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["sku"] },
    });

    const result = failWrite(err, {
      sku: "SKU DEMO already exists.",
    });

    expect(result).toEqual({
      ok: false,
      error: "SKU DEMO already exists.",
      fieldErrors: { sku: "SKU DEMO already exists." },
    });
  });

  it("returns a friendly form-level message for unknown write failures", () => {
    const result = failWrite(new Error("boom"));
    expect(result).toEqual({
      ok: false,
      error: "Could not save the record. Please try again.",
    });
  });
});

describe("failField", () => {
  it("attaches the message to a single field", () => {
    expect(failField("slug", "Taken.")).toEqual({
      ok: false,
      error: "Taken.",
      fieldErrors: { slug: "Taken." },
    });
  });
});
