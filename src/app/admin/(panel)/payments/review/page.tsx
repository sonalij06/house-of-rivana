import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AdminHeader, Panel } from "@/components/admin/primitives";
import {
  PaymentReviewCard,
  type ReviewItem,
} from "@/components/admin/payment-review-card";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Verify payments" };

export default async function PaymentReviewPage() {
  await requireStaff("/admin/payments/review");

  const payments = await prisma.payment.findMany({
    where: { status: "UNDER_REVIEW" },
    orderBy: { updatedAt: "asc" },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          email: true,
          phone: true,
          userId: true,
          shippingAddress: true,
          items: { select: { productName: true, quantity: true, variantLabel: true } },
        },
      },
    },
  });

  // Flag references that already exist elsewhere; a repeated UTR is the classic
  // manual-UPI dodge.
  const utrs = payments.map((p) => p.upiUtr).filter((u): u is string => Boolean(u));
  const duplicates =
    utrs.length > 0
      ? await prisma.payment.findMany({
          where: {
            upiUtr: { in: utrs },
            id: { notIn: payments.map((p) => p.id) },
          },
          select: { upiUtr: true, order: { select: { orderNumber: true } } },
        })
      : [];
  const duplicateByUtr = new Map(
    duplicates.map((d) => [d.upiUtr!, d.order.orderNumber]),
  );

  const repeatCustomerIds = new Set(
    (
      await prisma.order.groupBy({
        by: ["userId"],
        where: {
          userId: { in: payments.map((p) => p.order.userId).filter(Boolean) as string[] },
          status: { in: ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"] },
        },
        _count: { _all: true },
      })
    )
      .filter((group) => group._count._all > 0)
      .map((group) => group.userId!),
  );

  const items: ReviewItem[] = payments.map((payment) => {
    const address = payment.order.shippingAddress as { fullName?: string } | null;
    return {
      paymentId: payment.id,
      orderId: payment.order.id,
      orderNumber: payment.order.orderNumber,
      amountPaise: payment.amountPaise,
      utr: payment.upiUtr,
      payerVpa: payment.upiVpa,
      payerName: payment.payerName,
      hasProof: Boolean(payment.proofPath),
      submittedAt: payment.updatedAt,
      customerName: address?.fullName ?? "Guest",
      customerEmail: payment.order.email,
      customerPhone: payment.order.phone,
      itemSummary: payment.order.items
        .map((item) => `${item.productName} (${item.variantLabel}) × ${item.quantity}`)
        .join(", "),
      duplicateOf: payment.upiUtr ? duplicateByUtr.get(payment.upiUtr) ?? null : null,
      isRepeatCustomer: payment.order.userId
        ? repeatCustomerIds.has(payment.order.userId)
        : false,
    };
  });

  const totalPaise = items.reduce((sum, item) => sum + item.amountPaise, 0);

  return (
    <>
      <AdminHeader
        title="Verify payments"
        description="Match each reference against the bank statement before confirming. Confirming decrements stock, emails the customer and releases the order for packing."
      />

      {items.length === 0 ? (
        <Panel>
          <div className="py-10 text-center">
            <CheckCircle2
              className="mx-auto size-8 text-success"
              strokeWidth={1.3}
            />
            <p className="mt-4 font-display text-xl text-ink">Nothing to verify</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Every submitted payment has been dealt with. New UPI references land here
              the moment a buyer submits one.
            </p>
            <Link
              href="/admin/orders"
              className="mt-5 inline-block text-[0.6875rem] uppercase tracking-[0.14em] text-gold underline-offset-4 hover:underline"
            >
              Go to orders
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            <strong className="text-ink">{items.length}</strong>{" "}
            {items.length === 1 ? "payment" : "payments"} worth{" "}
            <strong className="tabular-nums text-ink">{formatPaise(totalPaise)}</strong>{" "}
            waiting, oldest first.
          </p>
          <div className="space-y-4">
            {items.map((item) => (
              <PaymentReviewCard key={item.paymentId} item={item} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
