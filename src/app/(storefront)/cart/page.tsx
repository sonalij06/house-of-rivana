import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CartLines } from "@/components/cart/cart-lines";
import { CouponForm } from "@/components/cart/coupon-form";
import { OrderSummary } from "@/components/cart/order-summary";
import { ProductGrid } from "@/components/product/product-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCartSnapshot } from "@/lib/cart";
import { getShowcaseProducts } from "@/lib/catalog";
import { getWishlistedProductIds } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: "Your bag",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const [snapshot, wishlisted] = await Promise.all([
    getCartSnapshot(),
    getWishlistedProductIds(),
  ]);

  if (snapshot.lines.length === 0) {
    const { bestsellers } = await getShowcaseProducts();
    return (
      <div className="container-site py-12 md:py-16">
        <PageHeader title="Your bag" crumbs={[{ label: "Bag" }]} align="center" />
        <EmptyState
          className="mt-6"
          icon={<ShoppingBag className="size-5" strokeWidth={1.5} />}
          title="Your bag is empty"
          description="Every piece is made in small batches, so favourites move quickly."
          action={
            <Button asChild>
              <Link href="/shop">Browse the collection</Link>
            </Button>
          }
        />

        {bestsellers.length ? (
          <div className="mt-16 border-t border-hairline pt-14">
            <SectionHeading
              eyebrow="Most loved"
              title="Where most people start"
              href="/shop"
              hrefLabel="Shop all"
            />
            <ProductGrid
              products={bestsellers}
              wishlisted={wishlisted}
              className="mt-10"
            />
          </div>
        ) : null}
      </div>
    );
  }

  const { breakdown } = snapshot;

  return (
    <div className="container-site py-12 md:py-16">
      <PageHeader
        eyebrow="Almost there"
        title="Your bag"
        description="Prices include GST. Shipping and any promotion are applied below, and confirmed again on our server before payment."
        crumbs={[{ label: "Bag" }]}
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
        <div>
          <CartLines
            lines={snapshot.lines}
            issues={snapshot.issues}
            wishlisted={[...wishlisted]}
          />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/shop"
              className="text-[0.6875rem] uppercase tracking-[0.14em] text-muted underline-offset-4 transition-colors hover:text-gold hover:underline"
            >
              Continue shopping
            </Link>
          </div>
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <OrderSummary breakdown={breakdown} couponCode={snapshot.couponCode}>
            <div className="space-y-4">
              <CouponForm
                appliedCode={breakdown.appliedCouponCode}
                couponError={breakdown.couponError?.message ?? null}
              />
              <Button asChild size="lg" block>
                <Link href="/checkout">Proceed to checkout</Link>
              </Button>
            </div>
          </OrderSummary>

          <p className="mt-4 px-1 text-xs leading-relaxed text-muted-light">
            Pay by UPI at checkout. Stock is held for you while you complete payment.
          </p>
        </div>
      </div>
    </div>
  );
}
