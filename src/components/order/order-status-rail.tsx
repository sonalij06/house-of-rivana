"use client";

import { motion } from "motion/react";
import { Check, Package, Sparkles, Truck, Wallet } from "lucide-react";
import type { OrderStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "placed", label: "Placed", icon: Sparkles },
  { key: "paid", label: "Paid", icon: Wallet },
  { key: "packed", label: "Packed", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Check },
] as const;

const REACHED: Record<OrderStatus, number> = {
  PENDING_PAYMENT: 0,
  PAYMENT_UNDER_REVIEW: 0,
  CONFIRMED: 1,
  PROCESSING: 1,
  PACKED: 2,
  SHIPPED: 3,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
  CANCELLED: -1,
  REFUNDED: -1,
  RETURN_REQUESTED: 4,
  RETURNED: -1,
};

/** Horizontal progress rail; collapses to a vertical list on small screens. */
export function OrderStatusRail({ status }: { status: OrderStatus }) {
  const reached = REACHED[status];

  if (reached < 0) {
    return (
      <div className="border border-hairline bg-cream-dark px-5 py-4 text-sm text-muted">
        This order is {status.toLowerCase().replace(/_/g, " ")}. Nothing further will be
        dispatched, and any amount debited is refunded to the original account.
      </div>
    );
  }

  const progress = reached / (STEPS.length - 1);

  return (
    <div className="relative">
      <div
        className="absolute left-4 top-4 hidden h-px w-[calc(100%-2rem)] bg-hairline sm:block"
        aria-hidden
      />
      <motion.div
        className="absolute left-4 top-4 hidden h-px origin-left bg-gold sm:block"
        style={{ width: "calc(100% - 2rem)" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: progress }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        aria-hidden
      />

      <ol className="relative flex flex-col gap-4 sm:flex-row sm:justify-between sm:gap-0">
        {STEPS.map((step, index) => {
          const done = index <= reached;
          const current = index === reached;
          const Icon = step.icon;

          return (
            <li
              key={step.key}
              className="flex items-center gap-3 sm:flex-col sm:gap-2"
              aria-current={current ? "step" : undefined}
            >
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.15 + index * 0.08,
                }}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                  done
                    ? "border-gold bg-gold text-cream"
                    : "border-hairline bg-surface text-muted-light",
                  current && "ring-2 ring-gold/25 ring-offset-2 ring-offset-cream",
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.8} />
              </motion.span>
              <span
                className={cn(
                  "text-[0.6875rem] uppercase tracking-[0.14em]",
                  done ? "text-ink" : "text-muted-light",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
