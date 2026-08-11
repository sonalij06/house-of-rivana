import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { OrderStatusRail } from "@/components/order/order-status-rail";
import { OrderTimeline } from "@/components/order/order-timeline";
import { OrderSummary } from "@/components/cart/order-summary";
import { SafeImage } from "@/components/ui/safe-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/primitives";
import {
  ORDER_STATUS_COPY,
  PAYMENT_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
  type OrderStatus,
  type PaymentStatus,
  type ShipmentStatus,
} from "@/lib/order-status";
import { features } from "@/lib/env";
import { syncShipmentFromShiprocket } from "@/lib/shipping/sync";
import { formatDate, formatPaise } from "@/lib/utils";
import { whatsappLink } from "@/lib/notifications";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderNumber } = await params;
  const { t: token } = await searchParams;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: { orderBy: { productName: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      shipments: {
        orderBy: { createdAt: "desc" },
        include: { events: { orderBy: { occurredAt: "desc" } } },
      },
      timeline: {
        where: { isCustomerVisible: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) notFound();

  const user = await getCurrentUser();
  const authorised =
    (user && order.userId === user.id) || (token && token === order.accessToken);
  if (!authorised) {
    redirect(`/login?next=/order/${orderNumber}`);
  }

  // Best-effort live pull so ETA / scans stay fresh even if the webhook missed.
  const openShipment = order.shipments.find(
    (s) =>
      s.awb &&
      s.status !== "DELIVERED" &&
      s.status !== "CANCELLED" &&
      s.status !== "RETURNED_TO_ORIGIN",
  );
  if (features.shiprocket && openShipment) {
    await syncShipmentFromShiprocket(openShipment.id).catch(() => undefined);
  }

  const fresh = openShipment
    ? await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          items: { orderBy: { productName: "asc" } },
          payments: { orderBy: { createdAt: "desc" } },
          shipments: {
            orderBy: { createdAt: "desc" },
            include: { events: { orderBy: { occurredAt: "desc" } } },
          },
          timeline: {
            where: { isCustomerVisible: true },
            orderBy: { createdAt: "asc" },
          },
        },
      })
    : null;
  const view = fresh ?? order;

  const settings = await getSettings();
  const status = view.status as OrderStatus;
  const copy = ORDER_STATUS_COPY[status];
  const address = view.shippingAddress as {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    landmark?: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
  const payment = view.payments[0] ?? null;
  const shipment = view.shipments[0] ?? null;

  const helpMessage = `Hello, I have a question about order ${view.orderNumber}.`;
  const whatsapp = settings.whatsappNumber
    ? whatsappLink(settings.whatsappNumber, helpMessage)
    : null;

  return (
    <div className="container-site max-w-4xl py-12 md:py-16">
      <Reveal>
        <p className="text-[0.6875rem] uppercase tracking-[0.2em] text-gold">
          Order <span data-selectable>{view.orderNumber}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-display text-4xl leading-tight text-ink md:text-5xl">
            {copy.label}
          </h1>
          <p className="text-xs text-muted">Placed {formatDate(view.placedAt, true)}</p>
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{copy.detail}</p>
      </Reveal>

      {status === "PENDING_PAYMENT" ? (
        <Reveal delay={0.1}>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-gold/30 bg-champagne-soft px-5 py-4">
            <p className="text-sm text-ink">
              {formatPaise(view.grandTotalPaise)} is still due on this order.
            </p>
            <Button asChild size="sm">
              <Link
                href={`/checkout/payment/${view.orderNumber}${token ? `?t=${token}` : ""}`}
              >
                Complete payment
              </Link>
            </Button>
          </div>
        </Reveal>
      ) : null}

      <Reveal delay={0.15}>
        <div className="mt-10 border border-hairline bg-surface p-6">
          <OrderStatusRail status={status} />
        </div>
      </Reveal>

      {shipment ? (
        <Reveal delay={0.2}>
          <section className="mt-6 border border-hairline bg-surface p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink">
                Tracking
              </h2>
              <Badge tone="neutral">
                {SHIPMENT_STATUS_LABEL[shipment.status as ShipmentStatus]}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-muted-light">
                  {shipment.carrier}
                </p>
                <p className="mt-1 text-lg tracking-[0.06em] tabular-nums text-ink">
                  {shipment.awb}
                </p>
                {shipment.estimatedDelivery ? (
                  <p className="mt-1 text-xs text-muted">
                    Estimated delivery {formatDate(shipment.estimatedDelivery)}
                  </p>
                ) : null}
              </div>
              {shipment.trackingUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                    Track with {shipment.carrier}
                    <ExternalLink className="size-3.5" strokeWidth={1.6} />
                  </a>
                </Button>
              ) : null}
            </div>

            {shipment.events.length ? (
              <ul className="mt-5 space-y-2.5 border-t border-hairline pt-4">
                {shipment.events.map((event) => (
                  <li key={event.id} className="flex justify-between gap-4 text-xs">
                    <span className="text-ink">
                      {event.description}
                      {event.location ? (
                        <span className="text-muted"> · {event.location}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-light">
                      {formatDate(event.occurredAt, true)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </Reveal>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Reveal delay={0.25} className="h-full">
          <section className="h-full border border-hairline bg-surface p-6">
            <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink">
              Delivering to
            </h2>
            <p className="mt-4 text-sm text-ink">{address.fullName}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {address.line1}
              {address.line2 ? <>, {address.line2}</> : null}
              {address.landmark ? <>, {address.landmark}</> : null}
              <br />
              {address.city}, {address.state} {address.postalCode}
              <br />
              {address.phone}
            </p>
            {order.giftWrap ? (
              <p className="mt-4 border-t border-hairline pt-3 text-xs text-gold">
                Gift wrapped · no prices on the invoice
              </p>
            ) : null}
            {order.customerNote ? (
              <p className="mt-4 border-t border-hairline pt-3 text-xs italic leading-relaxed text-muted">
                “{order.customerNote}”
              </p>
            ) : null}
          </section>
        </Reveal>

        <Reveal delay={0.3} className="h-full">
          <section className="h-full border border-hairline bg-surface p-6">
            <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink">
              Payment
            </h2>
            {payment ? (
              <dl className="mt-4 space-y-2.5 text-sm">
                <Row label="Method">
                  {payment.provider === "MANUAL_UPI" ? "UPI" : "Razorpay"}
                </Row>
                <Row label="Status">
                  {PAYMENT_STATUS_LABEL[payment.status as PaymentStatus]}
                </Row>
                {payment.upiUtr ? (
                  <Row label="Reference">
                    <span className="tabular-nums">{payment.upiUtr}</span>
                  </Row>
                ) : null}
                {order.paidAt ? (
                  <Row label="Paid on">{formatDate(order.paidAt, true)}</Row>
                ) : null}
                {payment.rejectionReason ? (
                  <p className="border-t border-hairline pt-3 text-xs leading-relaxed text-danger">
                    {payment.rejectionReason}
                  </p>
                ) : null}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted">No payment recorded yet.</p>
            )}

            {order.refundedPaise > 0 ? (
              <p className="mt-4 border-t border-hairline pt-3 text-xs text-muted">
                {formatPaise(order.refundedPaise)} refunded to the original account.
              </p>
            ) : null}
          </section>
        </Reveal>
      </div>

      <Reveal delay={0.35}>
        <section className="mt-6 border border-hairline bg-surface">
          <h2 className="border-b border-hairline px-6 py-4 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink">
            What you ordered
          </h2>
          <ul className="divide-y divide-hairline px-6">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-4 py-5">
                <Link
                  href={`/product/${item.productSlug}`}
                  className="relative size-20 shrink-0 overflow-hidden bg-cream-dark"
                >
                  <SafeImage
                    src={item.imageUrl}
                    alt={item.productName}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/product/${item.productSlug}`}
                    className="text-sm text-ink underline-offset-4 hover:underline"
                  >
                    {item.productName}
                  </Link>
                  <p className="mt-1 text-xs text-muted">{item.variantLabel}</p>
                  <p className="mt-0.5 text-xs text-muted-light">
                    {item.sku} · Qty {item.quantity}
                  </p>
                </div>
                <p className="shrink-0 text-sm tabular-nums text-ink">
                  {formatPaise(item.lineTotalPaise)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Reveal delay={0.4} className="h-full">
          <OrderSummary
            title="Order total"
            couponCode={order.couponCode}
            className="h-full"
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
        </Reveal>

        <Reveal delay={0.45} className="h-full">
          <section className="h-full border border-hairline bg-surface p-6">
            <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink">
              History
            </h2>
            <div className="mt-5">
              <OrderTimeline entries={view.timeline} />
            </div>
          </section>
        </Reveal>
      </div>

      <Reveal delay={0.5}>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-8">
          <p className="text-sm text-muted">
            Something not right? We answer every message ourselves.
          </p>
          <div className="flex flex-wrap gap-3">
            {whatsapp ? (
              <Button asChild variant="outline" size="sm">
                <a href={whatsapp} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-3.5" strokeWidth={1.6} />
                  WhatsApp us
                </a>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href="/contact">Contact the studio</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
