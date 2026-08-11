"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { failField, failMessage, failWrite, failZod } from "@/lib/action-errors";
import { features } from "@/lib/env";
import { assertAdmin, recordAudit } from "@/lib/session";
import { isValidVpa } from "@/lib/payments/upi";
import type { ActionResult } from "@/app/actions/cart";

const settingsSchema = z.object({
  brandName: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(120),
  supportEmail: z.string().trim().email("Enter a valid support email."),
  supportPhone: z.string().trim().max(24),
  whatsappNumber: z.string().trim().max(24),
  instagramUrl: z.string().trim().max(200),
  facebookUrl: z.string().trim().max(200),
  pinterestUrl: z.string().trim().max(200),
  addressText: z.string().trim().max(300),

  announcementText: z.string().trim().max(160),
  announcementEnabled: z.boolean(),

  activePaymentProvider: z.enum(["MANUAL_UPI", "RAZORPAY"]),
  upiVpa: z.string().trim().max(80),
  upiPayeeName: z.string().trim().max(80),

  freeShippingThresholdRupees: z.number().int().min(0).max(10_000_000),
  flatShippingRateRupees: z.number().int().min(0).max(100_000),
  gstPercent: z.number().min(0).max(28),
  gstInclusive: z.boolean(),
  paymentHoldMinutes: z.number().int().min(10).max(1440),
  lowStockAlertThreshold: z.number().int().min(0).max(500),
});

export async function updateSiteSettings(input: unknown): Promise<ActionResult> {
  const actor = await assertAdmin();

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return failZod(parsed.error);
  const data = parsed.data;

  // Guard rails: a provider that cannot actually take money must not go live.
  if (data.activePaymentProvider === "MANUAL_UPI" && !isValidVpa(data.upiVpa)) {
    return failField(
      "upiVpa",
      "UPI transfer needs a valid UPI ID, for example rivana@okhdfcbank.",
    );
  }
  if (data.activePaymentProvider === "RAZORPAY" && !features.razorpay) {
    return failMessage(
      "Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the environment before switching to Razorpay.",
    );
  }

  const before = await prisma.siteSetting.findUnique({ where: { id: "singleton" } });

  const payload = {
    brandName: data.brandName,
    tagline: data.tagline,
    supportEmail: data.supportEmail,
    supportPhone: data.supportPhone,
    whatsappNumber: data.whatsappNumber,
    instagramUrl: data.instagramUrl,
    facebookUrl: data.facebookUrl,
    pinterestUrl: data.pinterestUrl,
    addressText: data.addressText,
    announcementText: data.announcementText,
    announcementEnabled: data.announcementEnabled,
    activePaymentProvider: data.activePaymentProvider,
    upiVpa: data.upiVpa,
    upiPayeeName: data.upiPayeeName,
    freeShippingThresholdPaise: data.freeShippingThresholdRupees * 100,
    flatShippingRatePaise: data.flatShippingRateRupees * 100,
    gstBasisPoints: Math.round(data.gstPercent * 100),
    gstInclusive: data.gstInclusive,
    paymentHoldMinutes: data.paymentHoldMinutes,
    lowStockAlertThreshold: data.lowStockAlertThreshold,
  };

  try {
    const after = await prisma.siteSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...payload },
      update: payload,
    });

    await recordAudit({
      actor,
      action: "settings.update",
      entity: "SiteSetting",
      entityId: "singleton",
      before,
      after,
    });

    // Settings feed the header, footer, pricing and payment screens.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return failWrite(err);
  }
}

/** One-click provider switch from the payments panel. */
export async function setPaymentProvider(
  provider: "MANUAL_UPI" | "RAZORPAY",
): Promise<ActionResult> {
  const actor = await assertAdmin();

  if (provider === "RAZORPAY" && !features.razorpay) {
    return {
      ok: false,
      error: "Razorpay keys are missing from the environment.",
    };
  }

  const before = await prisma.siteSetting.findUnique({
    where: { id: "singleton" },
    select: { activePaymentProvider: true, upiVpa: true },
  });

  if (provider === "MANUAL_UPI" && !isValidVpa(before?.upiVpa ?? "")) {
    return { ok: false, error: "Set a valid UPI ID before switching to UPI transfer." };
  }

  await prisma.siteSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", activePaymentProvider: provider },
    update: { activePaymentProvider: provider },
  });

  await recordAudit({
    actor,
    action: "settings.payment-provider",
    entity: "SiteSetting",
    entityId: "singleton",
    before,
    after: { activePaymentProvider: provider },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
