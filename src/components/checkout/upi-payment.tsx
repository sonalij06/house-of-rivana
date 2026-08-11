"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, ExternalLink, Smartphone, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { abandonOrder, submitPaymentProof } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatPaise } from "@/lib/utils";

export type UpiIntent = {
  paymentId: string;
  uri: string;
  qrDataUrl: string;
  payeeVpa: string;
  payeeName: string;
  amountPaise: number;
  expiresAt: string;
};

/**
 * Manual UPI: pay from your own app, then tell us the reference. The QR is for
 * desktop, the intent link for mobile — a `upi://` href does nothing on desktop,
 * so we never show it as the primary action there.
 */
export function UpiPayment({
  intent,
  orderNumber,
  token,
}: {
  intent: UpiIntent;
  orderNumber: string;
  token?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<"pay" | "confirm" | "done">("pay");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const remaining = useCountdown(intent.expiresAt);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("orderNumber", orderNumber);
    formData.set("paymentId", intent.paymentId);
    if (token) formData.set("token", token);

    startTransition(async () => {
      const result = await submitPaymentProof(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // No router.refresh() here: the order has left PENDING_PAYMENT, so a
      // re-render of this route would redirect and swallow this confirmation.
      setStage("done");
      toast.success("Reference received.");
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await abandonOrder(orderNumber, token);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Order cancelled and the pieces returned to stock.");
      router.push("/shop");
    });
  }

  if (stage === "done") {
    return (
      <motion.div
        className="border border-hairline bg-surface px-6 py-12 text-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="size-5" strokeWidth={1.8} />
        </span>
        <h2 className="mt-5 font-display text-2xl text-ink">
          We are checking your payment
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
          Your reference is with us. We match it against our account by hand — usually
          within a couple of hours during business time — and email you the moment it
          clears. Nothing is dispatched before then.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href={`/order/${orderNumber}${token ? `?t=${token}` : ""}`}>
              View your order
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/shop">Keep browsing</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-hairline bg-surface">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline px-6 py-4">
          <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink">
            Pay by UPI
          </h2>
          <Countdown remaining={remaining} />
        </div>

        <div className="p-6">
          <p className="text-sm leading-relaxed text-muted">
            Send{" "}
            <strong className="tabular-nums text-ink">
              {formatPaise(intent.amountPaise)}
            </strong>{" "}
            to the UPI ID below from any app — GPay, PhonePe, Paytm, or your bank. Then
            come back and enter the reference number so we can match it.
          </p>

          <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
            <div className="mx-auto w-fit border border-hairline bg-white p-3 sm:mx-0">
              <Image
                src={intent.qrDataUrl}
                alt={`UPI QR code for ${formatPaise(intent.amountPaise)}`}
                width={180}
                height={180}
                unoptimized
                className="size-[180px]"
              />
              <p className="mt-2 text-center text-[0.5625rem] uppercase tracking-[0.14em] text-muted-light">
                Scan to pay
              </p>
            </div>

            <div className="space-y-4">
              <CopyRow label="UPI ID" value={intent.payeeVpa} />
              <CopyRow label="Payee" value={intent.payeeName} copyable={false} />
              <CopyRow
                label="Amount"
                value={(intent.amountPaise / 100).toFixed(2)}
                prefix="₹"
              />
              <CopyRow label="Reference" value={orderNumber} />

              {/* Only useful on a device that has a UPI app installed. */}
              <a
                href={intent.uri}
                className="flex h-11 w-full items-center justify-center gap-2 bg-ink text-[0.75rem] uppercase tracking-[0.14em] text-cream transition-colors hover:bg-gold sm:hidden"
              >
                <Smartphone className="size-4" strokeWidth={1.6} />
                Open a UPI app
              </a>
              <a
                href={intent.uri}
                className="hidden items-center gap-2 text-xs text-muted underline-offset-4 transition-colors hover:text-gold hover:underline sm:inline-flex"
              >
                <ExternalLink className="size-3.5" strokeWidth={1.6} />
                Open the payment link on this device
              </a>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {stage === "pay" ? (
          <motion.div
            key="prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button type="button" size="lg" block onClick={() => setStage("confirm")}>
              I have paid — enter the reference
            </Button>
          </motion.div>
        ) : (
          <motion.form
            key="confirm"
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="border border-hairline bg-surface p-6"
            encType="multipart/form-data"
          >
            <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink">
              Confirm your payment
            </h2>

            <div className="mt-5 space-y-5">
              <Field
                label="UPI reference number (UTR)"
                htmlFor="utr"
                hint="12 digits, shown as UTR, UPI Ref or Transaction ID in your app."
                required
              >
                <Input
                  id="utr"
                  name="utr"
                  inputMode="numeric"
                  maxLength={22}
                  autoComplete="off"
                  placeholder="123456789012"
                  required
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Your UPI ID" htmlFor="payerVpa" hint="Optional — speeds up matching">
                  <Input id="payerVpa" name="payerVpa" placeholder="you@bank" autoComplete="off" />
                </Field>
                <Field label="Name on the account" htmlFor="payerName">
                  <Input id="payerName" name="payerName" autoComplete="off" />
                </Field>
              </div>

              <div>
                <p className="mb-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted">
                  Screenshot
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  name="proof"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="sr-only"
                  onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center gap-3 border border-dashed border-hairline px-4 py-3 text-left transition-colors hover:border-ink"
                >
                  <Upload className="size-4 shrink-0 text-gold" strokeWidth={1.6} />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">
                    {fileName ?? "Attach the payment confirmation (optional)"}
                  </span>
                  {fileName ? (
                    <button
                      type="button"
                      aria-label="Remove attachment"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (fileRef.current) fileRef.current.value = "";
                        setFileName(null);
                      }}
                      className="shrink-0 text-muted-light transition-colors hover:text-danger"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </button>
                <p className="mt-1.5 text-xs text-muted">
                  Stored privately and visible only to the person verifying your payment.
                </p>
              </div>

              {error ? (
                <p
                  className="border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <Button type="submit" size="lg" block disabled={isPending}>
                {isPending ? <Spinner className="size-4" /> : null}
                Submit for verification
              </Button>
              <button
                type="button"
                onClick={() => setStage("pay")}
                className="w-full text-center text-xs uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
              >
                Back to the QR code
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="text-center">
        <button
          type="button"
          onClick={cancel}
          disabled={isPending}
          className="text-xs text-muted-light underline-offset-4 transition-colors hover:text-danger hover:underline disabled:opacity-50"
        >
          Cancel this order and release the stock
        </button>
      </div>
    </div>
  );
}

function CopyRow({
  label,
  value,
  prefix,
  copyable = true,
}: {
  label: string;
  value: string;
  prefix?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy is blocked in this browser — select the text instead.");
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline pb-3">
      <div className="min-w-0">
        <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-muted-light">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm text-ink" data-selectable>
          {prefix}
          {value}
        </p>
      </div>
      {copyable ? (
        <button
          type="button"
          onClick={copy}
          className={cn(
            "flex shrink-0 items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.12em] transition-colors",
            copied ? "text-success" : "text-muted hover:text-gold",
          )}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      ) : null}
    </div>
  );
}

function Countdown({ remaining }: { remaining: number }) {
  if (remaining <= 0) {
    return (
      <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-danger">
        Hold expired
      </p>
    );
  }
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return (
    <p
      className={cn(
        "text-[0.6875rem] uppercase tracking-[0.12em] tabular-nums",
        remaining < 300 ? "text-danger" : "text-muted",
      )}
    >
      Stock held · {minutes}:{String(seconds).padStart(2, "0")}
    </p>
  );
}

/** Seconds left on the stock hold, ticking client-side from a server timestamp. */
function useCountdown(isoDeadline: string) {
  const deadline = new Date(isoDeadline).getTime();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((deadline - Date.now()) / 1000)),
  );

  useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return remaining;
}
