import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { startPayment } from "@/app/actions/checkout";
import { UpiPayment } from "@/components/checkout/upi-payment";
import { RazorpayPayment } from "@/components/checkout/razorpay-payment";
import { OrderSummary } from "@/components/cart/order-summary";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Complete your payment",
  robots: { index: false, follow: false },
};

type Params = { orderNumber: string };
type Search = { t?: string };

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { orderNumber } = await params;
  const { t: token } = await searchParams;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { orderBy: { productName: "asc" } } },
  });
  if (!order) notFound();

  const user = await getCurrentUser();
  const authorised =
    (user && order.userId === user.id) || (token && token === order.accessToken);
  if (!authorised) {
    redirect(`/login?next=/checkout/payment/${orderNumber}`);
  }

  const orderHref = `/order/${order.orderNumber}${token ? `?t=${token}` : ""}`;
  if (order.status !== "PENDING_PAYMENT") redirect(orderHref);

  const address = order.shippingAddress as {
    fullName?: string;
    city?: string;
    state?: string;
  } | null;

  const intent = await startPayment(orderNumber, token);

  return (
    <div className="container-site py-12 md:py-16">
      <PageHeader
        eyebrow={`Order ${order.orderNumber}`}
        title="One step left"
        description={`${formatPaise(order.grandTotalPaise)} to complete your order. We hold your pieces while you pay.`}
        crumbs={[{ label: "Bag", href: "/cart" }, { label: "Payment" }]}
      />

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
        <div>
          {!intent.ok ? (
            <div className="border border-danger/25 bg-danger-soft p-6">
              <h2 className="font-display text-xl text-ink">
                We could not open the payment
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/75">{intent.error}</p>
              <p className="mt-4 text-sm text-muted">
                Your order is saved as {order.orderNumber}. Nothing has been charged.
                Email us and we will take payment another way.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link href="/contact">Contact us</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href={orderHref}>View the order</Link>
                </Button>
              </div>
            </div>
          ) : intent.data.kind === "upi_uri" ? (
            <UpiPayment
              orderNumber={order.orderNumber}
              token={token}
              intent={{
                paymentId: intent.data.paymentId,
                uri: intent.data.uri!,
                qrDataUrl: intent.data.qrDataUrl!,
                payeeVpa: intent.data.payeeVpa!,
                payeeName: intent.data.payeeName!,
                amountPaise: intent.data.amountPaise,
                expiresAt: intent.data.expiresAt,
              }}
            />
          ) : (
            <RazorpayPayment
              orderNumber={order.orderNumber}
              token={token}
              intent={{
                paymentId: intent.data.paymentId,
                providerOrderId: intent.data.providerOrderId!,
                keyId: intent.data.keyId!,
                amountPaise: intent.data.amountPaise,
              }}
              customer={{
                name: address?.fullName ?? "",
                email: order.email,
                phone: order.phone,
              }}
            />
          )}
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="border border-hairline bg-surface p-6">
            <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink">
              Shipping to
            </h2>
            <p className="mt-3 text-sm text-ink">{address?.fullName}</p>
            <p className="mt-1 text-xs text-muted">
              {address?.city}, {address?.state}
            </p>
            <ul className="mt-5 space-y-2 border-t border-hairline pt-4">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 text-xs">
                  <span className="min-w-0 truncate text-muted">
                    {item.productName} × {item.quantity}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink">
                    {formatPaise(item.lineTotalPaise)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <OrderSummary
            className="mt-4"
            title="Amount due"
            couponCode={order.couponCode}
            breakdown={{
              itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
              subtotalPaise: order.subtotalPaise,
              discountPaise: order.discountPaise,
              shippingPaise: order.shippingPaise,
              taxPaise: order.taxPaise,
              grandTotalPaise: order.grandTotalPaise,
              freeShippingRemainingPaise: 0,
              appliedCouponCode: order.couponCode,
              couponError: null,
            }}
          />
        </div>
      </div>
    </div>
  );
}
