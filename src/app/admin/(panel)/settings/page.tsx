import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/primitives";
import { SettingsForm } from "@/components/admin/settings-form";
import { env, features } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings");
  const settings = await getSettings();

  return (
    <>
      <AdminHeader
        title="Settings"
        description="Brand details, money rules and which payment provider takes the next order. Changes apply immediately across the storefront."
      />

      <SettingsForm
        razorpayConfigured={features.razorpay}
        razorpayWebhookConfigured={features.razorpayWebhook}
        webhookUrl={`${env.NEXT_PUBLIC_APP_URL}/api/webhooks/razorpay`}
        initial={{
          brandName: settings.brandName,
          tagline: settings.tagline,
          supportEmail: settings.supportEmail,
          supportPhone: settings.supportPhone,
          whatsappNumber: settings.whatsappNumber,
          instagramUrl: settings.instagramUrl,
          facebookUrl: settings.facebookUrl,
          pinterestUrl: settings.pinterestUrl,
          addressText: settings.addressText,
          announcementText: settings.announcementText,
          announcementEnabled: settings.announcementEnabled,
          activePaymentProvider: settings.activePaymentProvider,
          upiVpa: settings.upiVpa,
          upiPayeeName: settings.upiPayeeName,
          freeShippingThresholdRupees: settings.freeShippingThresholdPaise / 100,
          flatShippingRateRupees: settings.flatShippingRatePaise / 100,
          gstPercent: settings.gstBasisPoints / 100,
          paymentHoldMinutes: settings.paymentHoldMinutes,
          lowStockAlertThreshold: settings.lowStockAlertThreshold,
          gstInclusive: settings.gstInclusive,
        }}
      />
    </>
  );
}
