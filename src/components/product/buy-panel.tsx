"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Heart, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";
import { addToCart } from "@/app/actions/cart";
import { toggleWishlist } from "@/app/actions/wishlist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/ui/rating";
import { Spinner } from "@/components/ui/spinner";
import { DeliveryEstimate } from "@/components/shipping/delivery-estimate";
import { availableStock, metalLabel } from "@/lib/product";
import { useUIStore } from "@/stores/ui";
import { cn, discountPercent, formatPaise } from "@/lib/utils";

export type BuyPanelVariant = {
  id: string;
  sku: string;
  label: string;
  optionSize: string | null;
  optionMetal: string | null;
  optionLength: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  stockQty: number;
  reservedQty: number;
  lowStockThreshold: number;
};

export function BuyPanel({
  productId,
  productName,
  slug,
  shortDescription,
  metal,
  purity,
  gemstone,
  variants,
  ratingAverage,
  ratingCount,
  madeToOrderDays,
  freeShippingThresholdPaise,
  isWishlisted,
  collection,
}: {
  productId: string;
  productName: string;
  slug: string;
  shortDescription: string | null;
  metal: string;
  purity: string | null;
  gemstone: string | null;
  variants: BuyPanelVariant[];
  ratingAverage: number;
  ratingCount: number;
  madeToOrderDays: number | null;
  freeShippingThresholdPaise: number;
  isWishlisted: boolean;
  collection?: { slug: string; name: string };
}) {
  const router = useRouter();
  const { bump, openCart } = useUIStore();
  const [isPending, startTransition] = useTransition();
  const [wished, setWished] = useState(isWishlisted);
  const [quantity, setQuantity] = useState(1);

  // Preselect the first variant that can actually ship.
  const [variantId, setVariantId] = useState(
    () => (variants.find((v) => availableStock(v) > 0) ?? variants[0])?.id,
  );

  const variant = useMemo(
    () => variants.find((v) => v.id === variantId) ?? variants[0],
    [variantId, variants],
  );

  const axes = useMemo(() => variantAxes(variants), [variants]);
  const stock = variant ? availableStock(variant) : 0;
  const maxQuantity = Math.min(stock, 5);
  const saving = variant
    ? discountPercent(variant.pricePaise, variant.compareAtPaise)
    : null;
  const shortfall = variant
    ? freeShippingThresholdPaise - variant.pricePaise * quantity
    : 0;

  function add() {
    if (!variant || stock === 0) return;
    startTransition(async () => {
      const result = await addToCart({ variantId: variant.id, quantity });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      bump();
      openCart();
      toast.success(`${productName} added to your bag.`, {
        action: { label: "View bag", onClick: openCart },
      });
      router.refresh();
    });
  }

  function buyNow() {
    if (!variant || stock === 0) return;
    startTransition(async () => {
      const result = await addToCart({ variantId: variant.id, quantity });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push("/checkout");
    });
  }

  function wishlist() {
    const next = !wished;
    setWished(next);
    startTransition(async () => {
      const result = await toggleWishlist(productId);
      if (!result.ok) {
        setWished(!next);
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Saved to your wishlist." : "Removed from wishlist.");
      router.refresh();
    });
  }

  return (
    <div>
      {collection ? (
        <Link
          href={`/collections/${collection.slug}`}
          className="text-[0.6875rem] uppercase tracking-[0.18em] text-gold transition-colors hover:text-gold-dark"
        >
          {collection.name}
        </Link>
      ) : null}

      <h1 className="mt-2.5 font-display text-[2rem] leading-[1.1] text-ink md:text-[2.5rem]">
        {productName}
      </h1>

      {ratingCount > 0 ? (
        <a href="#reviews" className="mt-3 inline-flex">
          <Rating value={ratingAverage} count={ratingCount} />
        </a>
      ) : null}

      {shortDescription ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">{shortDescription}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-baseline gap-3">
        <motion.span
          key={variant?.pricePaise}
          className="font-display text-[1.75rem] leading-none text-ink"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {variant ? formatPaise(variant.pricePaise) : "—"}
        </motion.span>
        {variant?.compareAtPaise ? (
          <span className="text-sm tabular-nums text-muted-light line-through">
            {formatPaise(variant.compareAtPaise)}
          </span>
        ) : null}
        {saving ? <Badge tone="gold">{saving}% off</Badge> : null}
      </div>
      <p className="mt-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-muted-light">
        Inclusive of all taxes
      </p>

      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-y border-hairline py-4 text-xs">
        <Spec label="Finish" value={metalLabel(metal)} />
        {purity ? <Spec label="Plating" value={purity} /> : null}
        {gemstone ? <Spec label="Stone" value={gemstone} /> : null}
        {variant ? <Spec label="SKU" value={variant.sku} /> : null}
      </dl>

      {axes.map((axis, axisIndex) => (
        <fieldset key={axis.key} className="mt-7">
          <legend className="mb-3 flex w-full items-baseline justify-between gap-4">
            <span className="text-[0.625rem] font-medium uppercase tracking-[0.18em] text-ink">
              {axis.label}
              {variant?.[axis.key] ? (
                <span className="ml-2 font-normal normal-case tracking-normal text-muted">
                  {axis.format(String(variant[axis.key]))}
                </span>
              ) : null}
            </span>
            {axis.key === "optionSize" ? (
              <Link
                href="/size-guide"
                className="text-[0.625rem] uppercase tracking-[0.12em] text-gold underline-offset-4 hover:underline"
              >
                Size guide
              </Link>
            ) : null}
          </legend>
          <div className="flex flex-wrap gap-2">
            {axis.values.map((value) => {
              const available = isOptionAvailable(
                variants,
                axes.slice(0, axisIndex),
                axis.key,
                value,
                variant,
              );
              const active = variant?.[axis.key] === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    const next = resolveVariant(variants, axes, axis.key, value, variant);
                    if (next) setVariantId(next.id);
                    setQuantity(1);
                  }}
                  aria-pressed={active}
                  disabled={!available}
                  title={available ? undefined : "Sold out"}
                  className={cn(
                    "relative min-w-11 border px-3.5 py-2 text-xs transition-all duration-200",
                    active
                      ? "border-ink bg-ink text-cream"
                      : "border-hairline text-ink hover:border-ink",
                    !available &&
                      "cursor-not-allowed border-hairline text-muted-light hover:border-hairline",
                  )}
                >
                  {axis.format(value)}
                  {!available ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-1 top-1/2 h-px -rotate-12 bg-muted-light"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="mt-7 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[0.625rem] font-medium uppercase tracking-[0.18em] text-ink">
            Qty
          </span>
          <div className="flex items-center border border-hairline">
            <QtyButton
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              label="Decrease quantity"
            >
              <Minus className="size-3.5" strokeWidth={1.8} />
            </QtyButton>
            <span className="w-9 text-center text-sm tabular-nums">{quantity}</span>
            <QtyButton
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              disabled={quantity >= maxQuantity}
              label="Increase quantity"
            >
              <Plus className="size-3.5" strokeWidth={1.8} />
            </QtyButton>
          </div>
        </div>

        <StockNote
          stock={stock}
          threshold={variant?.lowStockThreshold ?? 2}
          madeToOrderDays={madeToOrderDays}
        />
      </div>

      <div className="mt-6 flex gap-3">
        <Button
          type="button"
          onClick={add}
          disabled={isPending || stock === 0}
          size="lg"
          className="flex-1"
        >
          {isPending ? (
            <Spinner className="size-4" />
          ) : (
            <ShoppingBag className="size-4" strokeWidth={1.6} />
          )}
          {stock === 0 ? "Sold out" : "Add to bag"}
        </Button>
        <Button
          type="button"
          onClick={wishlist}
          variant="subtle"
          size="lg"
          aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
          aria-pressed={wished}
          className="w-13 px-0"
        >
          <Heart className={cn("size-4", wished && "fill-gold text-gold")} strokeWidth={1.6} />
        </Button>
      </div>

      {stock > 0 ? (
        <Button
          type="button"
          onClick={buyNow}
          disabled={isPending}
          variant="outline"
          size="lg"
          block
          className="mt-3"
        >
          Buy it now
        </Button>
      ) : null}

      <AnimatePresence>
        {stock > 0 && shortfall > 0 ? (
          <motion.p
            className="mt-4 flex items-center gap-2 text-xs text-muted"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Truck className="size-3.5 text-gold" strokeWidth={1.6} />
            Add {formatPaise(shortfall)} more for free shipping.
          </motion.p>
        ) : stock > 0 ? (
          <motion.p
            className="mt-4 flex items-center gap-2 text-xs text-success"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Truck className="size-3.5" strokeWidth={1.6} />
            Free insured shipping on this order.
          </motion.p>
        ) : null}
      </AnimatePresence>

      <p className="mt-2 text-xs text-muted-light">
        Quality-checked and shipped in a Rivana box.{" "}
        <Link href="/policies/returns" className="text-gold underline-offset-4 hover:underline">
          15-day returns
        </Link>
        .
      </p>

      <DeliveryEstimate className="mt-6 border-t border-hairline pt-5" />

      <StickyBar
        productName={productName}
        pricePaise={variant?.pricePaise ?? 0}
        stock={stock}
        isPending={isPending}
        onAdd={add}
        slug={slug}
      />
    </div>
  );
}

/** Repeats the primary action once the panel scrolls out of reach on mobile. */
function StickyBar({
  productName,
  pricePaise,
  stock,
  isPending,
  onAdd,
}: {
  productName: string;
  pricePaise: number;
  stock: number;
  isPending: boolean;
  onAdd: () => void;
  slug: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-hairline bg-surface/95 px-4 py-3 backdrop-blur-sm lg:hidden">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted">{productName}</p>
        <p className="text-sm tabular-nums text-ink">{formatPaise(pricePaise)}</p>
      </div>
      <Button
        type="button"
        onClick={onAdd}
        disabled={isPending || stock === 0}
        size="md"
        className="shrink-0"
      >
        {isPending ? <Spinner className="size-4" /> : null}
        {stock === 0 ? "Sold out" : "Add to bag"}
      </Button>
    </div>
  );
}

function StockNote({
  stock,
  threshold,
  madeToOrderDays,
}: {
  stock: number;
  threshold: number;
  madeToOrderDays: number | null;
}) {
  if (stock === 0) {
    return <p className="text-xs text-danger">Sold out in this option</p>;
  }
  if (stock <= threshold) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-warning">
        <span className="size-1.5 rounded-full bg-warning" aria-hidden />
        Only {stock} left
      </p>
    );
  }
  if (madeToOrderDays) {
    return <p className="text-xs text-muted">Made to order · ships in {madeToOrderDays} days</p>;
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-success">
      <span className="size-1.5 rounded-full bg-success" aria-hidden />
      In stock · ships in 2 days
    </p>
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

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.5625rem] uppercase tracking-[0.16em] text-muted-light">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}

type AxisKey = "optionMetal" | "optionSize" | "optionLength";

type Axis = {
  key: AxisKey;
  label: string;
  values: string[];
  format: (value: string) => string;
};

const AXIS_DEFS: Omit<Axis, "values">[] = [
  { key: "optionMetal", label: "Metal", format: metalLabel },
  { key: "optionSize", label: "Size", format: (value) => value },
  { key: "optionLength", label: "Length", format: (value) => value },
];

/**
 * A piece can vary along metal, size and length at once, so the selector shows
 * one row per axis that actually differs between variants. Axes where every
 * variant agrees are omitted — they belong in the specification list instead.
 */
function variantAxes(variants: BuyPanelVariant[]): Axis[] {
  return AXIS_DEFS.flatMap((def) => {
    const values = [
      ...new Set(
        variants
          .map((variant) => variant[def.key])
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    return values.length > 1 ? [{ ...def, values }] : [];
  });
}

/**
 * Axes narrow left to right: metal is always selectable, but a size only counts
 * as available if it exists in stock for the metal already chosen. Without this
 * the panel would silently swap the metal when you pick an unstocked size.
 */
function isOptionAvailable(
  variants: BuyPanelVariant[],
  precedingAxes: Axis[],
  key: AxisKey,
  value: string,
  current?: BuyPanelVariant,
) {
  return variants.some(
    (variant) =>
      variant[key] === value &&
      availableStock(variant) > 0 &&
      precedingAxes.every((axis) => !current || variant[axis.key] === current[axis.key]),
  );
}

/**
 * Picks the variant for a newly chosen option value, holding the other axes
 * steady where that combination exists and relaxing them where it doesn't —
 * so choosing "rose gold" never lands on a combination that isn't stocked.
 */
function resolveVariant(
  variants: BuyPanelVariant[],
  axes: Axis[],
  changedKey: AxisKey,
  value: string,
  current?: BuyPanelVariant,
) {
  const matching = variants.filter((variant) => variant[changedKey] === value);
  if (!matching.length) return current;

  const others = axes.filter((axis) => axis.key !== changedKey);
  const exact = matching.filter((variant) =>
    others.every((axis) => !current || variant[axis.key] === current[axis.key]),
  );

  const preferInStock = (list: BuyPanelVariant[]) =>
    list.find((variant) => availableStock(variant) > 0) ?? list[0];

  return exact.length ? preferInStock(exact) : preferInStock(matching);
}
