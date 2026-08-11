"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, CreditCard, QrCode } from "lucide-react";
import { toast } from "sonner";
import { updateSiteSettings } from "@/app/actions/admin-settings";
import { Panel } from "@/components/admin/primitives";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type SettingsFormValues = {
  brandName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  instagramUrl: string;
  facebookUrl: string;
  pinterestUrl: string;
  addressText: string;
  announcementText: string;
  announcementEnabled: boolean;
  activePaymentProvider: "MANUAL_UPI" | "RAZORPAY";
  upiVpa: string;
  upiPayeeName: string;
  freeShippingThresholdRupees: number;
  flatShippingRateRupees: number;
  gstPercent: number;
  gstInclusive: boolean;
  paymentHoldMinutes: number;
  lowStockAlertThreshold: number;
};

export function SettingsForm({
  initial,
  razorpayConfigured,
  razorpayWebhookConfigured,
  webhookUrl,
}: {
  initial: SettingsFormValues;
  razorpayConfigured: boolean;
  razorpayWebhookConfigured: boolean;
  webhookUrl: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [provider, setProvider] = useState(initial.activePaymentProvider);
  const [announcementOn, setAnnouncementOn] = useState(initial.announcementEnabled);
  const [gstInclusive, setGstInclusive] = useState(initial.gstInclusive);
  const { fieldErrors, formError, clearErrors, applyFailure } = useFormErrors();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearErrors();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const num = (key: string) => Number(form.get(key) ?? 0);

    startTransition(async () => {
      const result = await updateSiteSettings({
        brandName: text("brandName"),
        tagline: text("tagline"),
        supportEmail: text("supportEmail"),
        supportPhone: text("supportPhone"),
        whatsappNumber: text("whatsappNumber"),
        instagramUrl: text("instagramUrl"),
        facebookUrl: text("facebookUrl"),
        pinterestUrl: text("pinterestUrl"),
        addressText: text("addressText"),
        announcementText: text("announcementText"),
        announcementEnabled: announcementOn,
        activePaymentProvider: provider,
        upiVpa: text("upiVpa"),
        upiPayeeName: text("upiPayeeName"),
        freeShippingThresholdRupees: num("freeShippingThresholdRupees"),
        flatShippingRateRupees: num("flatShippingRateRupees"),
        gstPercent: num("gstPercent"),
        gstInclusive,
        paymentHoldMinutes: num("paymentHoldMinutes"),
        lowStockAlertThreshold: num("lowStockAlertThreshold"),
      });

      if (!result.ok) {
        applyFailure(result);
        return;
      }
      toast.success("Settings saved.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Panel title="Payment provider">
        <div className="grid gap-3 sm:grid-cols-2">
          <ProviderCard
            active={provider === "MANUAL_UPI"}
            onSelect={() => setProvider("MANUAL_UPI")}
            icon={<QrCode className="size-4" strokeWidth={1.6} />}
            title="UPI transfer"
            description="Show a QR and a upi:// link. The buyer sends the money and submits the reference, which you verify by hand."
            note="No gateway fees. Needs someone to check the bank statement."
            ready
          />
          <ProviderCard
            active={provider === "RAZORPAY"}
            onSelect={() => setProvider("RAZORPAY")}
            icon={<CreditCard className="size-4" strokeWidth={1.6} />}
            title="Razorpay"
            description="UPI, cards, net banking and wallets through Standard Checkout. Orders confirm themselves from the webhook."
            note={
              razorpayConfigured
                ? razorpayWebhookConfigured
                  ? "Keys and webhook secret detected."
                  : "Keys detected, but RAZORPAY_WEBHOOK_SECRET is missing — orders would not auto-confirm."
                : "Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to switch this on."
            }
            ready={razorpayConfigured}
          />
        </div>

        {provider === "RAZORPAY" ? (
          <p className="mt-4 border border-hairline bg-cream px-4 py-3 text-xs leading-relaxed text-muted">
            Point the Razorpay dashboard webhook at{" "}
            <code className="text-ink">{webhookUrl}</code> and subscribe to{" "}
            <code className="text-ink">payment.captured</code> and{" "}
            <code className="text-ink">payment.failed</code>. UPI Collect was withdrawn on
            28 Feb 2026, so Checkout uses UPI Intent and QR.
          </p>
        ) : null}

        <div className="mt-5 grid gap-5 border-t border-hairline pt-5 sm:grid-cols-2">
          <Field
            label="UPI ID (VPA)"
            htmlFor="upiVpa"
            hint="Money lands here when UPI transfer is active."
            error={fieldErrors.upiVpa}
          >
            <Input
              id="upiVpa"
              name="upiVpa"
              defaultValue={initial.upiVpa}
              placeholder="rivana@okhdfcbank"
            />
          </Field>
          <Field label="Payee name" htmlFor="upiPayeeName" error={fieldErrors.upiPayeeName}>
            <Input
              id="upiPayeeName"
              name="upiPayeeName"
              defaultValue={initial.upiPayeeName}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Money and stock">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Free shipping above (₹)"
            htmlFor="freeShippingThresholdRupees"
            error={fieldErrors.freeShippingThresholdRupees}
          >
            <Input
              id="freeShippingThresholdRupees"
              name="freeShippingThresholdRupees"
              type="number"
              min={0}
              defaultValue={initial.freeShippingThresholdRupees}
            />
          </Field>
          <Field
            label="Flat shipping rate (₹)"
            htmlFor="flatShippingRateRupees"
            error={fieldErrors.flatShippingRateRupees}
          >
            <Input
              id="flatShippingRateRupees"
              name="flatShippingRateRupees"
              type="number"
              min={0}
              defaultValue={initial.flatShippingRateRupees}
            />
          </Field>
          <Field label="GST (%)" htmlFor="gstPercent" error={fieldErrors.gstPercent}>
            <Input
              id="gstPercent"
              name="gstPercent"
              type="number"
              step="0.01"
              min={0}
              max={28}
              defaultValue={initial.gstPercent}
            />
          </Field>
          <Field
            label="Stock hold (minutes)"
            htmlFor="paymentHoldMinutes"
            hint="How long an unpaid order keeps its pieces."
            error={fieldErrors.paymentHoldMinutes}
          >
            <Input
              id="paymentHoldMinutes"
              name="paymentHoldMinutes"
              type="number"
              min={10}
              max={1440}
              defaultValue={initial.paymentHoldMinutes}
            />
          </Field>
          <Field
            label="Low stock alert at"
            htmlFor="lowStockAlertThreshold"
            error={fieldErrors.lowStockAlertThreshold}
          >
            <Input
              id="lowStockAlertThreshold"
              name="lowStockAlertThreshold"
              type="number"
              min={0}
              defaultValue={initial.lowStockAlertThreshold}
            />
          </Field>
          <label className="flex cursor-pointer items-start gap-2.5 self-end pb-2 text-sm text-muted">
            <Checkbox
              checked={gstInclusive}
              onChange={(event) => setGstInclusive(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              GST is included in listed prices
              <span className="mt-0.5 block text-xs text-muted-light">
                Uncheck to add GST on top at checkout.
              </span>
            </span>
          </label>
        </div>
      </Panel>

      <Panel title="Brand and contact">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Brand name" htmlFor="brandName" required error={fieldErrors.brandName}>
            <Input id="brandName" name="brandName" defaultValue={initial.brandName} required />
          </Field>
          <Field label="Tagline" htmlFor="tagline" error={fieldErrors.tagline}>
            <Input id="tagline" name="tagline" defaultValue={initial.tagline} />
          </Field>
          <Field
            label="Support email"
            htmlFor="supportEmail"
            required
            error={fieldErrors.supportEmail}
          >
            <Input
              id="supportEmail"
              name="supportEmail"
              type="email"
              defaultValue={initial.supportEmail}
              required
            />
          </Field>
          <Field label="Support phone" htmlFor="supportPhone" error={fieldErrors.supportPhone}>
            <Input id="supportPhone" name="supportPhone" defaultValue={initial.supportPhone} />
          </Field>
          <Field
            label="WhatsApp number"
            htmlFor="whatsappNumber"
            hint="With country code. Powers order updates and the chat link."
            error={fieldErrors.whatsappNumber}
          >
            <Input
              id="whatsappNumber"
              name="whatsappNumber"
              defaultValue={initial.whatsappNumber}
              placeholder="+919876543210"
            />
          </Field>
          <Field label="Studio address" htmlFor="addressText" error={fieldErrors.addressText}>
            <Textarea
              id="addressText"
              name="addressText"
              rows={2}
              defaultValue={initial.addressText}
            />
          </Field>
          <Field label="Instagram URL" htmlFor="instagramUrl" error={fieldErrors.instagramUrl}>
            <Input id="instagramUrl" name="instagramUrl" defaultValue={initial.instagramUrl} />
          </Field>
          <Field label="Facebook URL" htmlFor="facebookUrl" error={fieldErrors.facebookUrl}>
            <Input id="facebookUrl" name="facebookUrl" defaultValue={initial.facebookUrl} />
          </Field>
          <Field label="Pinterest URL" htmlFor="pinterestUrl" error={fieldErrors.pinterestUrl}>
            <Input id="pinterestUrl" name="pinterestUrl" defaultValue={initial.pinterestUrl} />
          </Field>
        </div>
      </Panel>

      <Panel title="Announcement bar">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
          <Checkbox
            checked={announcementOn}
            onChange={(event) => setAnnouncementOn(event.target.checked)}
          />
          Show the announcement bar above the header
        </label>
        <Field
          label="Message"
          htmlFor="announcementText"
          className="mt-4"
          error={fieldErrors.announcementText}
        >
          <Input
            id="announcementText"
            name="announcementText"
            defaultValue={initial.announcementText}
            maxLength={160}
            placeholder="Complimentary insured shipping on orders above ₹2,500"
          />
        </Field>
      </Panel>

      {formError ? (
        <p className="text-xs text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-5 border-t border-hairline bg-cream/95 px-5 py-4 backdrop-blur md:-mx-8 md:px-8">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner className="size-4" /> : null}
          Save settings
        </Button>
      </div>
    </form>
  );
}

function ProviderCard({
  active,
  onSelect,
  icon,
  title,
  description,
  note,
  ready,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  note: string;
  ready: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "relative border p-4 text-left transition-colors",
        active ? "border-gold bg-cream" : "border-hairline hover:border-ink",
        !ready && "opacity-70",
      )}
    >
      {active ? (
        <span className="absolute right-3 top-3 flex size-4 items-center justify-center rounded-full bg-gold text-cream">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      ) : null}
      <span className="flex items-center gap-2 text-ink">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </span>
      <span className="mt-2 block text-xs leading-relaxed text-muted">{description}</span>
      <span
        className={cn(
          "mt-2.5 flex items-start gap-1.5 text-[0.6875rem] leading-relaxed",
          ready ? "text-muted-light" : "text-warning",
        )}
      >
        {!ready ? (
          <AlertTriangle className="mt-px size-3 shrink-0" strokeWidth={1.8} />
        ) : null}
        {note}
      </span>
    </button>
  );
}
