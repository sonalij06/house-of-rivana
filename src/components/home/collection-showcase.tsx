"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

export type ShowcaseCollection = {
  slug: string;
  name: string;
  subtitle: string | null;
  heroImage: string | null;
  productCount: number;
};

export function CollectionShowcase({
  collections,
}: {
  collections: ShowcaseCollection[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {collections.map((collection, i) => (
        <CollectionTile
          key={collection.slug}
          collection={collection}
          index={i}
          // The first tile spans two columns on desktop, which breaks the grid's
          // monotony without needing bespoke art direction per collection.
          featured={i === 0}
        />
      ))}
    </div>
  );
}

function CollectionTile({
  collection,
  index,
  featured,
}: {
  collection: ShowcaseCollection;
  index: number;
  featured: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.75, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className={cn(featured && "lg:col-span-2 lg:row-span-1")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/collections/${collection.slug}`}
        className="group relative block overflow-hidden bg-ink"
      >
        <div
          className={cn(
            "relative",
            featured ? "aspect-[4/5] lg:aspect-[16/11]" : "aspect-[4/5]",
          )}
        >
          <motion.div
            className="absolute inset-0"
            animate={{ scale: hovered ? 1.06 : 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <SafeImage
              src={collection.heroImage}
              alt={collection.name}
              fill
              sizes={featured ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 768px) 100vw, 25vw"}
              className="object-cover"
            />
          </motion.div>
          <div className="scrim-strong absolute inset-0" />

          <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h3 className="font-display text-[clamp(1.35rem,2.4vw,2rem)] leading-tight text-cream">
                  {collection.name}
                </h3>
                {collection.subtitle ? (
                  <p className="mt-1 text-xs text-cream/70">{collection.subtitle}</p>
                ) : null}
                <p className="mt-2.5 text-[0.625rem] uppercase tracking-[0.16em] text-champagne">
                  {collection.productCount}{" "}
                  {collection.productCount === 1 ? "piece" : "pieces"}
                </p>
              </div>
              <motion.span
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-cream/35 text-cream"
                animate={{
                  backgroundColor: hovered ? "#faf8f5" : "transparent",
                  color: hovered ? "#1a1a1a" : "#faf8f5",
                }}
                transition={{ duration: 0.35 }}
              >
                <ArrowUpRight className="size-4" strokeWidth={1.6} />
              </motion.span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
