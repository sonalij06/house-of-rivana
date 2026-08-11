"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { motion } from "motion/react";
import { Heart, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { addToCart } from "@/app/actions/cart";
import { toggleWishlist } from "@/app/actions/wishlist";
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";
import { availableStock, metalLabel, type ProductCardData } from "@/lib/product";
import { useUIStore } from "@/stores/ui";
import { cn, discountPercent, formatPaise } from "@/lib/utils";

export function ProductCard({
  product,
  priority = false,
  isWishlisted = false,
  className,
}: {
  product: ProductCardData;
  priority?: boolean;
  isWishlisted?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const imageRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [wished, setWished] = useState(isWishlisted);
  const [isPending, startTransition] = useTransition();
  const { bump, flyToCart, openCart, setProductOrigin } = useUIStore();

  const primary = product.images[0];
  const secondary = product.images[1];
  const inStock = product.variants.some((v) => availableStock(v) > 0);
  const singleVariant =
    product.variants.length === 1 && availableStock(product.variants[0]) > 0
      ? product.variants[0]
      : null;
  const saving = discountPercent(product.basePricePaise, product.compareAtPaise);
  const collectionName = product.collections[0]?.collection.name;

  function quickAdd(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    // Products with choices go to the detail page — guessing a ring size for
    // someone is worse than one extra click.
    if (!singleVariant) {
      router.push(`/product/${product.slug}`);
      return;
    }

    const rect = imageRef.current?.getBoundingClientRect();
    startTransition(async () => {
      const result = await addToCart({ variantId: singleVariant.id, quantity: 1 });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (rect && primary?.url) flyToCart(primary.url, rect);
      bump();
      toast.success(`${product.name} added to your bag.`, {
        action: { label: "View bag", onClick: openCart },
      });
      router.refresh();
    });
  }

  function wishlist(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next = !wished;
    setWished(next);
    startTransition(async () => {
      const result = await toggleWishlist(product.id);
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
    <motion.article
      className={cn("group relative", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/product/${product.slug}`}
        className="block"
        // Hands the detail page this thumbnail's position so its hero can
        // animate out of it rather than appearing from nowhere.
        onClick={() => {
          const rect = imageRef.current?.getBoundingClientRect();
          if (rect) setProductOrigin(product.slug, rect);
        }}
      >
        <div
          ref={imageRef}
          className="relative aspect-square overflow-hidden bg-cream-dark"
        >
          <motion.div
            className="absolute inset-0"
            animate={{ scale: hovered ? 1.04 : 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <SafeImage
              src={primary?.url}
              alt={primary?.alt ?? product.name}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              placeholder={primary?.blurDataUrl ? "blur" : undefined}
              blurDataURL={primary?.blurDataUrl ?? undefined}
              className="object-cover"
            />
          </motion.div>

          {secondary ? (
            <motion.div
              className="absolute inset-0"
              initial={false}
              animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1.04 : 1.08 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <SafeImage
                src={secondary.url}
                alt={secondary.alt}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
            </motion.div>
          ) : null}

          <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {!inStock ? (
              <Tag tone="ink">Sold out</Tag>
            ) : saving ? (
              <Tag tone="gold">{saving}% off</Tag>
            ) : product.isNewArrival ? (
              <Tag tone="cream">New</Tag>
            ) : product.isBestseller ? (
              <Tag tone="cream">Bestseller</Tag>
            ) : null}
            {product.madeToOrderDays ? (
              <Tag tone="cream">Made to order</Tag>
            ) : null}
          </div>

          <button
            type="button"
            onClick={wishlist}
            aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
            aria-pressed={wished}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-cream/85 text-ink backdrop-blur-sm transition-all duration-300 hover:bg-cream hover:text-gold md:opacity-0 md:group-hover:opacity-100"
          >
            <Heart
              className={cn("size-3.5", wished && "fill-gold text-gold")}
              strokeWidth={1.6}
            />
          </button>

          {inStock ? (
            <motion.div
              className="absolute inset-x-3 bottom-3 hidden md:block"
              initial={false}
              animate={{ y: hovered ? 0 : 16, opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                onClick={quickAdd}
                disabled={isPending}
                className="flex h-10 w-full items-center justify-center gap-2 bg-cream/95 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ink backdrop-blur-sm transition-colors hover:bg-ink hover:text-cream disabled:opacity-60"
              >
                {isPending ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <ShoppingBag className="size-3.5" strokeWidth={1.6} />
                )}
                {singleVariant ? "Add to bag" : "Choose options"}
              </button>
            </motion.div>
          ) : null}
        </div>

        <div className="pt-4">
          {collectionName ? (
            <p className="text-[0.625rem] uppercase tracking-[0.16em] text-muted-light">
              {collectionName}
            </p>
          ) : null}
          <h3 className="mt-1.5 inline-block">
            <span className="rule-wipe font-display text-[1.0625rem] leading-snug text-ink transition-colors group-hover:text-gold">
              {product.name}
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {metalLabel(product.metal)}
            {product.gemstone ? ` · ${product.gemstone.split(",")[0]}` : ""}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm tabular-nums text-ink">
              {formatPaise(product.basePricePaise)}
            </span>
            {product.compareAtPaise ? (
              <span className="text-xs tabular-nums text-muted-light line-through">
                {formatPaise(product.compareAtPaise)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      {/* Mobile has no hover, so quick-add lives below the card. */}
      {inStock ? (
        <button
          type="button"
          onClick={quickAdd}
          disabled={isPending}
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 border border-hairline text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ink transition-colors hover:border-ink disabled:opacity-60 md:hidden"
        >
          {isPending ? <Spinner className="size-3.5" /> : null}
          {singleVariant ? "Add to bag" : "Choose options"}
        </button>
      ) : null}
    </motion.article>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "gold" | "ink" | "cream";
}) {
  return (
    <span
      className={cn(
        "px-2 py-1 text-[0.5625rem] font-medium uppercase tracking-[0.14em]",
        tone === "gold" && "bg-gold text-cream",
        tone === "ink" && "bg-ink text-cream",
        tone === "cream" && "bg-cream/90 text-ink backdrop-blur-sm",
      )}
    >
      {children}
    </span>
  );
}
