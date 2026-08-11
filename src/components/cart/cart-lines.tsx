"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Heart, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeCartItem, updateCartItem } from "@/app/actions/cart";
import { toggleWishlist } from "@/app/actions/wishlist";
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";
import type { CartLine } from "@/lib/cart";
import { formatPaise } from "@/lib/utils";

export function CartLines({
  lines,
  issues,
  wishlisted,
}: {
  lines: CartLine[];
  issues: { variantId: string; message: string }[];
  wishlisted: string[];
}) {
  const router = useRouter();
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const saved = new Set(wishlisted);

  // Stock can change while a cart sits open; say so once, on arrival.
  useEffect(() => {
    for (const issue of issues) toast.warning(issue.message);
  }, [issues]);

  function changeQuantity(itemId: string, quantity: number) {
    setPendingItem(itemId);
    startTransition(async () => {
      const result = await updateCartItem(itemId, quantity);
      if (!result.ok) toast.error(result.error);
      setPendingItem(null);
      router.refresh();
    });
  }

  function remove(line: CartLine) {
    setPendingItem(line.itemId);
    startTransition(async () => {
      await removeCartItem(line.itemId);
      setPendingItem(null);
      toast.success(`${line.name} removed.`);
      router.refresh();
    });
  }

  function moveToWishlist(line: CartLine) {
    setPendingItem(line.itemId);
    startTransition(async () => {
      if (!saved.has(line.productId)) {
        const result = await toggleWishlist(line.productId);
        if (!result.ok) {
          toast.error(result.error);
          setPendingItem(null);
          return;
        }
      }
      await removeCartItem(line.itemId);
      setPendingItem(null);
      toast.success(`${line.name} moved to your wishlist.`);
      router.refresh();
    });
  }

  return (
    <ul className="divide-y divide-hairline border-y border-hairline">
      <AnimatePresence initial={false}>
        {lines.map((line) => {
          const busy = isPending && pendingItem === line.itemId;
          return (
            <motion.li
              key={line.itemId}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex gap-5 py-6">
                <Link
                  href={`/product/${line.slug}`}
                  className="relative size-24 shrink-0 overflow-hidden bg-cream-dark sm:size-28"
                >
                  <SafeImage
                    src={line.imageUrl}
                    alt={line.imageAlt}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/product/${line.slug}`}
                        className="rule-wipe font-display text-lg leading-snug text-ink transition-colors hover:text-gold"
                      >
                        {line.name}
                      </Link>
                      <p className="mt-1 text-xs text-muted">{line.variantLabel}</p>
                      <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.12em] text-muted-light">
                        {line.sku}
                      </p>
                      {line.madeToOrderDays ? (
                        <p className="mt-1.5 text-xs text-muted">
                          Made to order · ships in {line.madeToOrderDays} days
                        </p>
                      ) : null}
                      {line.availableStock <= 2 ? (
                        <p className="mt-1.5 text-xs text-warning">
                          Only {line.availableStock} left
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm tabular-nums text-ink">
                        {formatPaise(line.lineTotalPaise)}
                      </p>
                      {line.quantity > 1 ? (
                        <p className="mt-0.5 text-xs tabular-nums text-muted-light">
                          {formatPaise(line.unitPricePaise)} each
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-4">
                    <div className="flex items-center border border-hairline">
                      <QtyButton
                        label="Decrease quantity"
                        disabled={busy}
                        onClick={() => changeQuantity(line.itemId, line.quantity - 1)}
                      >
                        <Minus className="size-3.5" strokeWidth={1.8} />
                      </QtyButton>
                      <span className="flex w-9 justify-center text-sm tabular-nums">
                        {busy ? <Spinner className="size-3.5 text-muted" /> : line.quantity}
                      </span>
                      <QtyButton
                        label="Increase quantity"
                        disabled={busy || line.quantity >= line.availableStock}
                        onClick={() => changeQuantity(line.itemId, line.quantity + 1)}
                      >
                        <Plus className="size-3.5" strokeWidth={1.8} />
                      </QtyButton>
                    </div>

                    <button
                      type="button"
                      onClick={() => moveToWishlist(line)}
                      disabled={busy}
                      className="flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-muted transition-colors hover:text-gold disabled:opacity-40"
                    >
                      <Heart className="size-3.5" strokeWidth={1.6} />
                      Save for later
                    </button>

                    <button
                      type="button"
                      onClick={() => remove(line)}
                      disabled={busy}
                      className="flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-muted transition-colors hover:text-danger disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.6} />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

function QtyButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 items-center justify-center text-ink transition-colors hover:bg-cream-dark disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
