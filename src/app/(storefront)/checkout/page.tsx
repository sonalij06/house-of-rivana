import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { OrderSummary } from "@/components/cart/order-summary";
import { SafeImage } from "@/components/ui/safe-image";
import { listSavedAddresses } from "@/app/actions/checkout";
import { getCartSnapshot } from "@/lib/cart";
import { getActiveProvider } from "@/lib/payments";
import { getCurrentUser } from "@/lib/session";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const snapshot = await getCartSnapshot();
  if (snapshot.lines.length === 0) redirect("/cart");

  const [user, savedAddresses, provider] = await Promise.all([
    getCurrentUser(),
    listSavedAddresses(),
    getActiveProvider(),
  ]);

  return (
    <div className="container-site py-12 md:py-16">
      <PageHeader
        eyebrow="Secure checkout"
        title="Where should it go?"
        description="We ship insured across India and every parcel is signed for. Totals are recalculated here from our own prices before you pay."
        crumbs={[{ label: "Bag", href: "/cart" }, { label: "Checkout" }]}
      />

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
        <CheckoutForm
          defaultEmail={user?.email ?? ""}
          isSignedIn={Boolean(user)}
          savedAddresses={savedAddresses.map((address) => ({
            id: address.id,
            label: address.label,
            fullName: address.fullName,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2,
            landmark: address.landmark,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
            isDefault: address.isDefault,
          }))}
          providerLabel={provider.label}
        />

        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="border border-hairline bg-surface">
            <h2 className="border-b border-hairline px-6 py-4 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink">
              {snapshot.breakdown.itemCount}{" "}
              {snapshot.breakdown.itemCount === 1 ? "piece" : "pieces"} in your bag
            </h2>
            <ul className="divide-y divide-hairline px-6">
              {snapshot.lines.map((line) => (
                <li key={line.itemId} className="flex gap-4 py-4">
                  <div className="relative size-14 shrink-0 overflow-hidden bg-cream-dark">
                    <SafeImage
                      src={line.imageUrl}
                      alt={line.imageAlt}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{line.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {line.variantLabel} · Qty {line.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-ink">
                    {formatPaise(line.lineTotalPaise)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <OrderSummary
            breakdown={snapshot.breakdown}
            couponCode={snapshot.couponCode}
            title="You pay"
            className="mt-4"
            footnote={
              <Link
                href="/cart"
                className="text-[0.6875rem] uppercase tracking-[0.14em] text-muted underline-offset-4 transition-colors hover:text-gold hover:underline"
              >
                Edit your bag
              </Link>
            }
          />
        </div>
      </div>
    </div>
  );
}
