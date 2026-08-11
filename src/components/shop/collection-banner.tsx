"use client";

import { motion } from "motion/react";
import { SafeImage } from "@/components/ui/safe-image";
import { SplitText } from "@/components/motion/primitives";

/**
 * Full-bleed collection header with a slow drift, so the edit gets an
 * editorial opening rather than a plain h1 over cream.
 */
export function CollectionBanner({
  name,
  subtitle,
  description,
  heroImage,
  productCount,
}: {
  name: string;
  subtitle: string | null;
  description: string | null;
  heroImage: string | null;
  productCount: number;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-ink">
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <SafeImage
          src={heroImage}
          alt={name}
          fill
          priority
          sizes="100vw"
          className="object-cover motion-safe:animate-drift"
        />
      </motion.div>
      <div className="scrim absolute inset-0" />

      <div className="container-site relative flex min-h-[42vh] flex-col justify-end py-14 md:min-h-[52vh] md:py-20">
        {subtitle ? (
          <motion.p
            className="text-[0.6875rem] uppercase tracking-[0.22em] text-champagne"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {subtitle}
          </motion.p>
        ) : null}

        <h1 className="mt-3 max-w-3xl font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02] text-cream">
          <SplitText text={name} as="span" delay={0.2} />
        </h1>

        {description ? (
          <motion.p
            className="mt-5 max-w-lg text-sm leading-relaxed text-cream/75"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {description}
          </motion.p>
        ) : null}

        <motion.p
          className="mt-7 text-[0.625rem] uppercase tracking-[0.18em] text-cream/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          {productCount} {productCount === 1 ? "piece" : "pieces"}
        </motion.p>
      </div>
    </section>
  );
}
