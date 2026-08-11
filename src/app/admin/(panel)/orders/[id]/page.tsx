import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";
import {
  AdminHeader,
  DataTable,
  Panel,
  StatusPill,
  Td,
} from "@/components/admin/primitives";
import { OrderActions } from "@/components/admin/order-actions";
import { PaymentReviewCard } from "@/components/admin/payment-review-card";
import { prisma } from "@/lib/db";
import { nextStatuses } from "@/lib/orders";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { whatsappLink } from "@/lib/notifications";
import {
  PAYMENT_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
  type OrderStatus,
  type PaymentStatus,
  type ShipmentStatus,
} from "@/lib/order-status";
import { features } from "@/lib/env";
import { formatDate, formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("/admin/orders");
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { orderBy: { productName: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      shipments: {
        orderBy: { createdAt: "desc" },
        include: { events: { orderBy: { occurredAt: "desc" } } },
      },
      timeline: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } },
      },
      user: { select: { id: true, name: true, email: true, _count: { select: { orders: true } } } },
      notifications: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!order) notFound();

  const settings = await getSettings();
  const status = order.status as OrderStatus;
  const address = order.shippingAddress as {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    landmark?: string | null;
    city: string;
    state: string;
    postalCode: string;
  };

  const paymentUnderReview = order.payments.find((p) => p.status === "UNDER_REVIEW");
  const shipment = order.shipments[0] ?? null;
  const gatewayPayment = order.payments.find(
    (p) => p.provider === "RAZORPAY" && (p.status === "PAID" || p.status === "PARTIALLY_REFUNDED"),
  );

  const wa = settings.whatsappNumber
    ? whatsappLink(
        order.phone,
        `Hello ${address.fullName.split(" ")[0]}, this is House of Rivana about your order ${order.orderNumber}.`,
      )
    : null;

  return (
    <>
      <AdminHeader
        title={order.orderNumber}
        description={`Placed ${formatDate(order.placedAt, true)} · ${formatPaise(order.grandTotalPaise)}${order.giftWrap ? " · gift wrapped" : ""}`}
        back={{ href: "/admin/orders", label: "All orders" }}
      >
        <StatusPill status={order.status} />
        <Link
          href={`/order/${order.orderNumber}?t=${order.accessToken}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 border border-hairline px-3 py-1.5 text-[0.625rem] uppercase tracking-[0.12em] text-muted transition-colors hover:border-ink hover:text-ink"
        >
          <ExternalLink className="size-3" />
          Customer view
        </Link>
      </AdminHeader>

      {paymentUnderReview ? (
        <div className="mb-5">
          <p className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-gold">
            Payment awaiting verification
          </p>
          <PaymentReviewCard
            item={{
              paymentId: paymentUnderReview.id,
              orderId: order.id,
              orderNumber: order.orderNumber,
              amountPaise: paymentUnderReview.amountPaise,
              utr: paymentUnderReview.upiUtr,
              payerVpa: paymentUnderReview.upiVpa,
              payerName: paymentUnderReview.payerName,
              hasProof: Boolean(paymentUnderReview.proofPath),
              submittedAt: paymentUnderReview.updatedAt,
              customerName: address.fullName,
              customerEmail: order.email,
              customerPhone: order.phone,
              itemSummary: order.items
                .map((item) => `${item.productName} × ${item.quantity}`)
                .join(", "),
              duplicateOf: null,
              isRepeatCustomer: (order.user?._count.orders ?? 0) > 1,
            }}
          />
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Panel title="Items" padded={false}>
            <DataTable head={["Piece", "SKU", "Qty", "Total"]} minWidth="26rem">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <Td>
                    <Link
                      href={`/product/${item.productSlug}`}
                      target="_blank"
                      className="text-ink underline-offset-4 hover:underline"
                    >
                      {item.productName}
                    </Link>
                    <span className="mt-0.5 block text-[0.6875rem] text-muted">
                      {item.variantLabel} · {formatPaise(item.unitPricePaise)} each
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[0.6875rem] text-muted">
                      {item.sku}
                    </span>
                  </Td>
                  <Td>
                    <span className="tabular-nums text-muted">{item.quantity}</span>
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums text-ink">
                      {formatPaise(item.lineTotalPaise)}
                    </span>
                  </Td>
                </tr>
              ))}
            </DataTable>

            <dl className="space-y-2 border-t border-hairline px-5 py-4 text-sm">
              <Row label="Subtotal">{formatPaise(order.subtotalPaise)}</Row>
              {order.discountPaise > 0 ? (
                <Row label={`Discount${order.couponCode ? ` · ${order.couponCode}` : ""}`}>
                  −{formatPaise(order.discountPaise)}
                </Row>
              ) : null}
              <Row label="Shipping">{formatPaise(order.shippingPaise)}</Row>
              {order.taxPaise > 0 ? (
                <Row label="GST (included)">{formatPaise(order.taxPaise)}</Row>
              ) : null}
              <div className="flex justify-between border-t border-hairline pt-2.5">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="font-display text-lg tabular-nums text-ink">
                  {formatPaise(order.grandTotalPaise)}
                </dd>
              </div>
              {order.refundedPaise > 0 ? (
                <Row label="Refunded">−{formatPaise(order.refundedPaise)}</Row>
              ) : null}
            </dl>
          </Panel>

          <div className="grid gap-5 sm:grid-cols-2">
            <Panel title="Ship to">
              <p className="text-sm text-ink">{address.fullName}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {address.line1}
                {address.line2 ? <>, {address.line2}</> : null}
                {address.landmark ? <>, {address.landmark}</> : null}
                <br />
                {address.city}, {address.state} {address.postalCode}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 border-t border-hairline pt-3 text-[0.6875rem]">
                <a
                  href={`mailto:${order.email}`}
                  className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-gold"
                >
                  <Mail className="size-3" />
                  {order.email}
                </a>
                <a
                  href={`tel:${order.phone}`}
                  className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-gold"
                >
                  <Phone className="size-3" />
                  {order.phone}
                </a>
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-success"
                  >
                    <MessageCircle className="size-3" />
                    WhatsApp
                  </a>
                ) : null}
              </div>
              {order.user ? (
                <p className="mt-3 text-xs text-muted-light">
                  Account holder · {order.user._count.orders}{" "}
                  {order.user._count.orders === 1 ? "order" : "orders"} total
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-light">Guest checkout</p>
              )}
            </Panel>

            <Panel title="Payments">
              {order.payments.length === 0 ? (
                <p className="text-sm text-muted">No payment attempts yet.</p>
              ) : (
                <ul className="space-y-3">
                  {order.payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="border-b border-hairline pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-ink">
                          {payment.provider === "MANUAL_UPI" ? "UPI transfer" : "Razorpay"}
                        </span>
                        <StatusPill
                          status={payment.status}
                          label={PAYMENT_STATUS_LABEL[payment.status as PaymentStatus]}
                        />
                      </div>
                      <p className="mt-1.5 text-xs tabular-nums text-muted">
                        {formatPaise(payment.amountPaise)} ·{" "}
                        {formatDate(payment.createdAt, true)}
                      </p>
                      {payment.upiUtr ? (
                        <p className="mt-0.5 font-mono text-[0.6875rem] text-muted-light">
                          UTR {payment.upiUtr}
                        </p>
                      ) : null}
                      {payment.providerPaymentId ? (
                        <p className="mt-0.5 font-mono text-[0.6875rem] text-muted-light">
                          {payment.providerPaymentId}
                        </p>
                      ) : null}
                      {payment.rejectionReason ? (
                        <p className="mt-1 text-[0.6875rem] text-danger">
                          {payment.rejectionReason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {shipment ? (
            <Panel title="Shipment">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm text-ink">{shipment.carrier}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">{shipment.awb}</p>
                </div>
                <StatusPill
                  status={shipment.status}
                  label={SHIPMENT_STATUS_LABEL[shipment.status as ShipmentStatus]}
                />
              </div>
              {shipment.events.length ? (
                <ul className="mt-4 space-y-2 border-t border-hairline pt-3">
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
            </Panel>
          ) : null}

          {order.customerNote ? (
            <Panel title="Customer note">
              <p className="text-sm italic leading-relaxed text-muted">
                “{order.customerNote}”
              </p>
            </Panel>
          ) : null}

          <Panel title="Timeline">
            <ol className="space-y-3.5">
              {order.timeline.map((entry) => (
                <li key={entry.id} className="border-b border-hairline pb-3 last:border-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm text-ink">{entry.message}</p>
                    <p className="text-[0.625rem] tabular-nums text-muted-light">
                      {formatDate(entry.createdAt, true)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.1em] text-muted-light">
                    {entry.type.toLowerCase().replace(/_/g, " ")}
                    {entry.actor?.name ? ` · ${entry.actor.name}` : ""}
                    {entry.isCustomerVisible ? "" : " · internal"}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>

          {order.notifications.length ? (
            <Panel title="Messages sent" padded={false}>
              <DataTable head={["Template", "To", "Channel", "Status"]} minWidth="26rem">
                {order.notifications.map((log) => (
                  <tr key={log.id}>
                    <Td>
                      <span className="text-xs text-ink">{log.template}</span>
                      <span className="mt-0.5 block text-[0.625rem] tabular-nums text-muted-light">
                        {formatDate(log.createdAt, true)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-muted">{log.recipient}</span>
                    </Td>
                    <Td>
                      <span className="text-xs text-muted">{log.channel}</span>
                    </Td>
                    <Td align="right">
                      <StatusPill status={log.status} />
                    </Td>
                  </tr>
                ))}
              </DataTable>
            </Panel>
          ) : null}
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <OrderActions
            orderId={order.id}
            status={status}
            nextStatuses={nextStatuses(status) as OrderStatus[]}
            grandTotalPaise={order.grandTotalPaise}
            refundedPaise={order.refundedPaise}
            hasGatewayPayment={Boolean(gatewayPayment)}
            shiprocketReady={features.shiprocket}
            shipment={
              shipment
                ? {
                    id: shipment.id,
                    status: shipment.status,
                    carrier: shipment.carrier,
                    awb: shipment.awb,
                  }
                : null
            }
          />
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{children}</dd>
    </div>
  );
}
