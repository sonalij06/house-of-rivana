"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { removeCartItem, updateCartItem } from "@/app/actions/cart";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";
import type { CartSnapshot } from "@/lib/cart";
import { useCartStore } from "@/stores/cart";
import { useUIStore } from "@/stores/ui";
import { formatPaise } from "@/lib/utils";

export function CartDrawer({ snapshot }: { snapshot: CartSnapshot }) {
  const { cartOpen, closeCart } = useUIStore();
  const setFromServer = useCartStore((s) => s.setFromServer);
  const router = useRouter();
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Keep the persisted guest mirror aligned with the authoritative server cart.
  useEffect(() => {
    setFromServer(
      snapshot.lines.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        productId: line.productId,
        slug: line.slug,
        name: line.name,
        variantLabel: line.variantLabel,
        imageUrl: line.imageUrl,
        unitPricePaise: line.unitPricePaise,
      })),
      snapshot.breakdown.itemCount,
    );
  }, [snapshot, setFromServer]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeCart();
    }
    if (cartOpen) {
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [cartOpen, closeCart]);

  // Surface stock problems the moment the drawer opens, not at checkout.
  useEffect(() => {
    if (!cartOpen) return;
    for (const issue of snapshot.issues) toast.warning(issue.message);
  }, [cartOpen, snapshot.issues]);

  function changeQuantity(itemId: string, quantity: number) {
    setPendingItem(itemId);
    startTransition(async () => {
      const result = await updateCartItem(itemId, quantity);
      if (!result.ok) toast.error(result.error);
      setPendingItem(null);
      router.refresh();
    });
  }

  function remove(itemId: string) {
    setPendingItem(itemId);
    startTransition(async () => {
      await removeCartItem(itemId);
      setPendingItem(null);
      router.refresh();
    });
  }

  const { lines, breakdown } = snapshot;

  return (
    <AnimatePresence>
      {cartOpen ? (
        <motion.div
          className="fixed inset-0 z-60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            onClick={closeCart}
            aria-label="Close bag"
          />

          <motion.aside
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-hairline bg-cream shadow-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32, mass: 0.9 }}
            role="dialog"
            aria-label="Shopping bag"
          >
            <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <h2 className="text-[0.8125rem] font-medium uppercase tracking-[0.16em] text-ink">
                Your Bag
                {breakdown.itemCount > 0 ? (
                  <span className="ml-2 text-muted">({breakdown.itemCount})</span>
                ) : null}
              </h2>
              <button
                type="button"
                onClick={closeCart}
                className="-mr-1.5 p-1.5 text-muted transition-colors hover:text-ink"
                aria-label="Close bag"
              >
                <X className="size-4" />
              </button>
            </header>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <div className="mb-5 flex size-14 items-center justify-center rounded-full border border-hairline text-muted-light">
                  <ShoppingBag className="size-5" strokeWidth={1.5} />
                </div>
                <p className="font-display text-2xl text-ink">Your bag is empty</p>
                <p className="mt-2 text-sm text-muted">
                  Every piece is made in small batches, so favourites move quickly.
                </p>
                <Button asChild variant="primary" className="mt-7">
                  <Link href="/shop" onClick={closeCart}>
                    Browse the collection
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5">
                  {breakdown.freeShippingRemainingPaise > 0 ? (
                    <FreeShippingMeter
                      remaining={breakdown.freeShippingRemainingPaise}
                      subtotal={breakdown.subtotalPaise - breakdown.discountPaise}
                    />
                  ) : (
                    <p className="mt-4 rounded-xs bg-success-soft px-3 py-2 text-center text-xs text-success">
                      Insured shipping is on us.
                    </p>
                  )}

                  <ul className="divide-y divide-hairline">
                    <AnimatePresence initial={false}>
                      {lines.map((line) => (
                        <motion.li
                          key={line.itemId}
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="flex gap-4 py-5">
                            <Link
                              href={`/product/${line.slug}`}
                              onClick={closeCart}
                              className="relative size-20 shrink-0 overflow-hidden bg-cream-dark"
                            >
                              <SafeImage
                                src={line.imageUrl}
                                alt={line.imageAlt}
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            </Link>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <Link
                                    href={`/product/${line.slug}`}
                                    onClick={closeCart}
                                    className="block truncate text-sm text-ink transition-colors hover:text-gold"
                                  >
                                    {line.name}
                                  </Link>
                                  <p className="mt-0.5 text-xs text-muted">
                                    {line.variantLabel}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => remove(line.itemId)}
                                  disabled={isPending && pendingItem === line.itemId}
                                  className="p-1 text-muted-light transition-colors hover:text-danger"
                                  aria-label={`Remove ${line.name}`}
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <div className="flex items-center border border-hairline">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeQuantity(line.itemId, line.quantity - 1)
                                    }
                                    disabled={isPending}
                                    className="flex size-8 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-40"
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus className="size-3" />
                                  </button>
                                  <span className="w-8 text-center text-sm tabular-nums">
                                    {isPending && pendingItem === line.itemId ? (
                                      <Spinner className="size-3 text-muted" />
                                    ) : (
                                      line.quantity
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeQuantity(line.itemId, line.quantity + 1)
                                    }
                                    disabled={
                                      isPending || line.quantity >= line.availableStock
                                    }
                                    className="flex size-8 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-40"
                                    aria-label="Increase quantity"
                                  >
                                    <Plus className="size-3" />
                                  </button>
                                </div>
                                <p className="text-sm tabular-nums text-ink">
                                  {formatPaise(line.lineTotalPaise)}
                                </p>
                              </div>

                              {line.availableStock <= 2 ? (
                                <p className="mt-2 text-xs text-warning">
                                  Only {line.availableStock} left
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>

                <footer className="border-t border-hairline bg-surface px-5 py-4">
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted">
                      <dt>Subtotal</dt>
                      <dd className="tabular-nums">
                        {formatPaise(breakdown.subtotalPaise)}
                      </dd>
                    </div>
                    {breakdown.discountPaise > 0 ? (
                      <div className="flex justify-between text-success">
                        <dt>Discount {snapshot.couponCode ? `(${snapshot.couponCode})` : ""}</dt>
                        <dd className="tabular-nums">
                          -{formatPaise(breakdown.discountPaise)}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-muted">
                      <dt>Shipping</dt>
                      <dd className="tabular-nums">
                        {breakdown.shippingPaise === 0
                          ? "Complimentary"
                          : formatPaise(breakdown.shippingPaise)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-hairline pt-2.5 text-base text-ink">
                      <dt className="font-medium">Total</dt>
                      <dd className="font-medium tabular-nums">
                        {formatPaise(breakdown.grandTotalPaise)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-1.5 text-[0.6875rem] text-muted">
                    Inclusive of GST. Calculated at checkout.
                  </p>

                  <Button asChild variant="primary" block className="mt-4">
                    <Link href="/checkout" onClick={closeCart}>
                      Checkout
                    </Link>
                  </Button>
                  <button
                    type="button"
                    onClick={closeCart}
                    className="mt-3 w-full text-center text-xs uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
                  >
                    Continue shopping
                  </button>
                </footer>
              </>
            )}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function FreeShippingMeter({
  remaining,
  subtotal,
}: {
  remaining: number;
  subtotal: number;
}) {
  const threshold = subtotal + remaining;
  const progress = Math.min(100, Math.round((subtotal / threshold) * 100));

  return (
    <div className="mt-4 rounded-xs border border-hairline bg-surface px-3 py-2.5">
      <p className="text-xs text-ink-soft">
        Add <strong className="text-gold">{formatPaise(remaining)}</strong> more for
        complimentary insured shipping.
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-cream-dark">
        <motion.div
          className="h-full bg-gold"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
