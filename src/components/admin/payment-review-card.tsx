"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Check, Copy, Eye, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { declinePayment, getProofUrl, verifyPayment } from "@/app/actions/admin-orders";
import { StatusPill } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatPaise } from "@/lib/utils";

export type ReviewItem = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  utr: string | null;
  payerVpa: string | null;
  payerName: string | null;
  hasProof: boolean;
  submittedAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  itemSummary: string;
  /** Same UTR seen on another order — a duplicate is the usual fraud signal. */
  duplicateOf: string | null;
  isRepeatCustomer: boolean;
};

const DECLINE_REASONS = [
  "No matching credit found in our account",
  "The reference number does not exist",
  "The amount received is less than the order total",
  "This reference belongs to an earlier order",
];

/**
 * One payment to reconcile. Everything the operator needs to decide is on the
 * card: amount, reference, who sent it, and whether that reference has been used
 * before.
 */
export function PaymentReviewCard({ item }: { item: ReviewItem }) {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "decline">("idle");
  const [reason, setReason] = useState(DECLINE_REASONS[0]);
  const [note, setNote] = useState("");
  const [resolved, setResolved] = useState<"verified" | "declined" | null>(null);

  function approve() {
    startTransition(async () => {
      const result = await verifyPayment({ paymentId: item.paymentId, note });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setResolved("verified");
      toast.success(result.data.message);
    });
  }

  function decline() {
    startTransition(async () => {
      const result = await declinePayment({ paymentId: item.paymentId, reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setResolved("declined");
      toast.success(result.data.message);
    });
  }

  function openProof() {
    startTransition(async () => {
      const result = await getProofUrl(item.paymentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.data.url, "_blank", "noopener");
    });
  }

  async function copyUtr() {
    if (!item.utr) return;
    try {
      await navigator.clipboard.writeText(item.utr);
      toast.success("Reference copied.");
    } catch {
      toast.error("Copy is blocked in this browser.");
    }
  }

  if (resolved) {
    return (
      <motion.div
        layout
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        className="border border-hairline bg-surface px-5 py-4"
      >
        <p className="flex items-center gap-2 text-sm text-muted">
          {resolved === "verified" ? (
            <Check className="size-4 text-success" strokeWidth={1.8} />
          ) : (
            <X className="size-4 text-danger" strokeWidth={1.8} />
          )}
          {item.orderNumber} {resolved === "verified" ? "confirmed" : "declined"}. The
          customer has been notified.
          <Link
            href={`/admin/orders/${item.orderId}`}
            className="text-gold underline-offset-4 hover:underline"
          >
            Open order
          </Link>
        </p>
      </motion.div>
    );
  }

  return (
    <motion.article layout className="border border-hairline bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/admin/orders/${item.orderId}`}
              className="font-mono text-[0.8125rem] text-ink underline-offset-4 hover:underline"
            >
              {item.orderNumber}
            </Link>
            <StatusPill status="UNDER_REVIEW" label="awaiting review" />
            {item.isRepeatCustomer ? (
              <span className="rounded-full bg-cream-dark px-2 py-0.5 text-[0.625rem] uppercase tracking-[0.1em] text-muted">
                Repeat buyer
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 truncate text-xs text-muted">
            {item.customerName} · {item.customerEmail} · {item.customerPhone}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-light">{item.itemSummary}</p>
        </div>

        <div className="text-right">
          <p className="font-display text-2xl leading-none tabular-nums text-ink">
            {formatPaise(item.amountPaise)}
          </p>
          <p className="mt-1 text-[0.625rem] tabular-nums text-muted-light">
            {formatDate(item.submittedAt, true)}
          </p>
        </div>
      </div>

      {item.duplicateOf ? (
        <p className="flex items-start gap-2 border-b border-danger/20 bg-danger-soft px-5 py-3 text-xs leading-relaxed text-danger">
          <ShieldAlert className="mt-px size-3.5 shrink-0" strokeWidth={1.8} />
          This reference is already recorded against {item.duplicateOf}. Confirm with the
          bank statement before approving.
        </p>
      ) : null}

      <div className="grid gap-5 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[0.5625rem] uppercase tracking-[0.16em] text-muted-light">
              UPI reference
            </dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="font-mono text-sm tabular-nums text-ink">
                {item.utr ?? "—"}
              </span>
              {item.utr ? (
                <button
                  type="button"
                  onClick={copyUtr}
                  aria-label="Copy the reference"
                  className="text-muted transition-colors hover:text-gold"
                >
                  <Copy className="size-3" />
                </button>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-[0.5625rem] uppercase tracking-[0.16em] text-muted-light">
              Payer UPI ID
            </dt>
            <dd className="mt-1 truncate text-sm text-ink">{item.payerVpa ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[0.5625rem] uppercase tracking-[0.16em] text-muted-light">
              Name given
            </dt>
            <dd className="mt-1 truncate text-sm text-ink">{item.payerName ?? "—"}</dd>
          </div>
        </dl>

        {item.hasProof ? (
          <Button variant="outline" size="sm" onClick={openProof} disabled={isPending}>
            <Eye className="size-3.5" strokeWidth={1.6} />
            Screenshot
          </Button>
        ) : (
          <p className="text-xs text-muted-light">No screenshot attached</p>
        )}
      </div>

      {mode === "decline" ? (
        <div className="border-t border-hairline bg-cream px-5 py-4">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink">
            Why are you declining?
          </p>
          <p className="mt-1 text-xs text-muted">
            This exact wording is emailed to the customer, and the order goes back to
            awaiting payment with a fresh hold.
          </p>
          <div className="mt-3 space-y-1.5">
            {DECLINE_REASONS.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2.5 text-sm text-muted"
              >
                <input
                  type="radio"
                  name={`reason-${item.paymentId}`}
                  checked={reason === option}
                  onChange={() => setReason(option)}
                  className="size-3.5 accent-[#8b6914]"
                />
                {option}
              </label>
            ))}
          </div>
          <Input
            className="mt-3"
            placeholder="Or write your own reason"
            onChange={(event) => setReason(event.target.value || DECLINE_REASONS[0])}
          />
          <div className="mt-4 flex gap-2">
            <Button variant="danger" size="sm" onClick={decline} disabled={isPending}>
              {isPending ? <Spinner className="size-3.5" /> : null}
              Decline and notify
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMode("idle")}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-cream px-5 py-4">
          <Button size="sm" onClick={approve} disabled={isPending}>
            {isPending ? <Spinner className="size-3.5" /> : null}
            Confirm payment received
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode("decline")}
            disabled={isPending}
          >
            Decline
          </Button>
          <Textarea
            rows={1}
            placeholder="Optional internal note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="ml-auto min-h-9 w-full max-w-xs resize-none py-2"
          />
        </div>
      )}
    </motion.article>
  );
}
