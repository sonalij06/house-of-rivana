import { Lock, Truck } from "lucide-react";
import type { PriceBreakdown } from "@/lib/pricing";
import { formatPaise } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** The money panel, shared by /cart, /checkout and the confirmation page. */
export function OrderSummary({
  breakdown,
  couponCode,
  title = "Summary",
  children,
  footnote,
  className,
}: {
  breakdown: PriceBreakdown;
  couponCode?: string | null;
  title?: string;
  children?: React.ReactNode;
  footnote?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border border-hairline bg-surface p-6", className)}>
      <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink">
        {title}
      </h2>

      <dl className="mt-5 space-y-2.5 text-sm">
        <Row label={`Subtotal (${breakdown.itemCount} ${breakdown.itemCount === 1 ? "item" : "items"})`}>
          {formatPaise(breakdown.subtotalPaise)}
        </Row>

        {breakdown.discountPaise > 0 ? (
          <Row
            label={couponCode ? `Discount · ${couponCode}` : "Discount"}
            tone="success"
          >
            −{formatPaise(breakdown.discountPaise)}
          </Row>
        ) : null}

        <Row label="Insured shipping">
          {breakdown.shippingPaise === 0 ? (
            <span className="text-success">Complimentary</span>
          ) : (
            formatPaise(breakdown.shippingPaise)
          )}
        </Row>

        {breakdown.taxPaise > 0 ? (
          <Row label="GST (included)" tone="muted-light">
            {formatPaise(breakdown.taxPaise)}
          </Row>
        ) : null}

        <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-3.5">
          <dt className="text-[0.8125rem] font-medium uppercase tracking-[0.12em] text-ink">
            Total
          </dt>
          <dd
            data-testid="order-total"
            className="font-display text-[1.375rem] leading-none tabular-nums text-ink"
          >
            {formatPaise(breakdown.grandTotalPaise)}
          </dd>
        </div>
      </dl>

      {children ? <div className="mt-6">{children}</div> : null}

      <ul className="mt-6 space-y-2 border-t border-hairline pt-5">
        <li className="flex items-center gap-2 text-xs text-muted">
          <Lock className="size-3.5 shrink-0 text-gold" strokeWidth={1.6} />
          Totals are recalculated on our server before payment.
        </li>
        <li className="flex items-center gap-2 text-xs text-muted">
          <Truck className="size-3.5 shrink-0 text-gold" strokeWidth={1.6} />
          Every parcel is insured and signed for on delivery.
        </li>
      </ul>

      {footnote ? <div className="mt-4">{footnote}</div> : null}
    </div>
  );
}

function Row({
  label,
  children,
  tone = "muted",
}: {
  label: string;
  children: React.ReactNode;
  tone?: "muted" | "success" | "muted-light";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt
        className={cn(
          tone === "success" && "text-success",
          tone === "muted" && "text-muted",
          tone === "muted-light" && "text-muted-light",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          tone === "success" ? "text-success" : "text-ink",
          tone === "muted-light" && "text-muted-light",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
