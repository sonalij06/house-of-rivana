import { cache } from "react";
import { prisma } from "@/lib/db";
import type { PricingSettings } from "@/lib/pricing";

export type SiteSettings = Awaited<ReturnType<typeof getSettings>>;

const DEFAULTS = {
  id: "singleton",
  brandName: "House of Rivana",
  tagline: "Fashion jewellery, made to be worn",
  supportEmail: "care@houseofrivana.com",
  supportPhone: "",
  whatsappNumber: "",
  instagramUrl: "",
  facebookUrl: "",
  pinterestUrl: "",
  addressText: "",
  announcementText: "",
  announcementEnabled: false,
  activePaymentProvider: "MANUAL_UPI" as const,
  upiVpa: "",
  upiPayeeName: "House of Rivana",
  upiQrImageUrl: null,
  freeShippingThresholdPaise: 250_000,
  flatShippingRatePaise: 9_900,
  gstBasisPoints: 300,
  gstInclusive: true,
  paymentHoldMinutes: 45,
  lowStockAlertThreshold: 3,
  updatedAt: new Date(),
};

/**
 * Settings are read on nearly every request, so this is request-cached. Writes
 * from /admin/settings call revalidatePath("/", "layout") to clear the route
 * cache that sits above it.
 */
export const getSettings = cache(async () => {
  const row = await prisma.siteSetting.findUnique({
    where: { id: "singleton" },
  });
  return row ?? DEFAULTS;
});

export async function getPricingSettings(): Promise<PricingSettings> {
  const s = await getSettings();
  return {
    freeShippingThresholdPaise: s.freeShippingThresholdPaise,
    flatShippingRatePaise: s.flatShippingRatePaise,
    gstBasisPoints: s.gstBasisPoints,
    gstInclusive: s.gstInclusive,
  };
}
