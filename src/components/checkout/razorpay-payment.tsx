"use client";

import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatPaise } from "@/lib/utils";

export type RazorpayIntent = {
  paymentId: string;
  providerOrderId: string;
  keyId: string;
  amountPaise: number;
};

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  notes: Record<string, string>;
  theme: { color: string };
  handler: (response: Record<string, string>) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

/**
 * Standard Checkout. The handler response is only a hint — the order is confirmed
 * by the payment.captured webhook, so we send the buyer to the order page and let
 * it reflect whatever the webhook recorded.
 */
export function RazorpayPayment({
  intent,
  orderNumber,
  token,
  customer,
}: {
  intent: RazorpayIntent;
  orderNumber: string;
  token?: string;
  customer: { name: string; email: string; phone: string };
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(false);
  const orderHref = `/order/${orderNumber}${token ? `?t=${token}` : ""}`;

  function open() {
    if (!window.Razorpay) {
      toast.error("The payment window could not load. Refresh and try again.");
      return;
    }
    setOpening(true);

    const checkout = new window.Razorpay({
      key: intent.keyId,
      order_id: intent.providerOrderId,
      amount: intent.amountPaise,
      currency: "INR",
      name: "House of Rivana",
      description: `Order ${orderNumber}`,
      prefill: {
        name: customer.name,
        email: customer.email,
        contact: customer.phone,
      },
      notes: { orderNumber },
      theme: { color: "#8b6914" },
      handler: () => {
        toast.success("Payment received. Confirming your order.");
        router.push(orderHref);
      },
      modal: {
        ondismiss: () => {
          setOpening(false);
          toast.info("Payment window closed. Your bag is still held.");
        },
      },
    });

    checkout.open();
  }

  return (
    <div className="border border-hairline bg-surface p-6">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setReady(true)}
        onError={() => toast.error("The payment window could not load.")}
      />

      <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink">
        Pay securely
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Pay{" "}
        <strong className="tabular-nums text-ink">
          {formatPaise(intent.amountPaise)}
        </strong>{" "}
        by UPI, card, net banking or wallet. The payment window opens over this page and
        your order confirms the moment it clears.
      </p>

      <Button className="mt-6" size="lg" block onClick={open} disabled={!ready || opening}>
        {!ready || opening ? <Spinner className="size-4" /> : null}
        {ready ? `Pay ${formatPaise(intent.amountPaise)}` : "Loading payment window"}
      </Button>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-light">
        <ShieldCheck className="size-3.5" strokeWidth={1.6} />
        Card details never touch our servers
      </p>

      <p className="mt-6 border-t border-hairline pt-4 text-center text-xs text-muted">
        Already paid?{" "}
        <Link href={orderHref} className="text-gold underline-offset-4 hover:underline">
          Check your order status
        </Link>
        .
      </p>
    </div>
  );
}
