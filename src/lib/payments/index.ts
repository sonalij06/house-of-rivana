import { getSettings } from "@/lib/settings";
import { manualUpiProvider } from "@/lib/payments/manual-upi";
import { razorpayProvider } from "@/lib/payments/razorpay";
import { features } from "@/lib/env";
import type { PaymentProvider, PaymentProviderId } from "@/lib/payments/types";
import type { PaymentProviderKind } from "@/generated/prisma/client";

export * from "@/lib/payments/types";

const PROVIDERS: Record<PaymentProviderId, PaymentProvider> = {
  manual_upi: manualUpiProvider,
  razorpay: razorpayProvider,
};

const KIND_TO_ID: Record<PaymentProviderKind, PaymentProviderId> = {
  MANUAL_UPI: "manual_upi",
  RAZORPAY: "razorpay",
};

export const ID_TO_KIND: Record<PaymentProviderId, PaymentProviderKind> = {
  manual_upi: "MANUAL_UPI",
  razorpay: "RAZORPAY",
};

/**
 * Resolves the live provider from settings, falling back to manual UPI if
 * Razorpay is selected but its keys are absent — losing sales to a
 * half-configured gateway would be worse than taking payment by hand.
 */
export async function getActiveProvider(): Promise<PaymentProvider> {
  const settings = await getSettings();
  const id = KIND_TO_ID[settings.activePaymentProvider];
  if (id === "razorpay" && !features.razorpay) {
    console.warn("Razorpay is selected but its keys are missing; using manual UPI.");
    return PROVIDERS.manual_upi;
  }
  return PROVIDERS[id];
}

export function getProvider(id: PaymentProviderId): PaymentProvider {
  return PROVIDERS[id];
}

export function providerForKind(kind: PaymentProviderKind): PaymentProvider {
  return PROVIDERS[KIND_TO_ID[kind]];
}

/** Which providers the deployment could switch to right now. */
export function availableProviders() {
  return [
    { id: "manual_upi" as const, label: manualUpiProvider.label, ready: true },
    {
      id: "razorpay" as const,
      label: razorpayProvider.label,
      ready: features.razorpay,
    },
  ];
}
