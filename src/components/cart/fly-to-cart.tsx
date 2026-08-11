"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { useUIStore } from "@/stores/ui";

/**
 * A ghost of the product image arcs up to the bag icon after a successful add.
 * Purely decorative: it is fixed-position, pointer-events-none, and self-clears.
 */
export function FlyToCart() {
  const { fly, clearFly } = useUIStore();

  useEffect(() => {
    if (!fly) return;
    const timer = setTimeout(clearFly, 720);
    return () => clearTimeout(timer);
  }, [fly, clearFly]);

  return (
    <AnimatePresence>
      {fly ? (
        <motion.img
          key={fly.key}
          src={fly.imageUrl}
          alt=""
          aria-hidden
          className="pointer-events-none fixed z-70 rounded-xs object-cover"
          initial={{
            top: fly.rect.top,
            left: fly.rect.left,
            width: fly.rect.width,
            height: fly.rect.height,
            opacity: 0.95,
            borderRadius: 2,
          }}
          animate={{
            top: 26,
            left: typeof window === "undefined" ? 0 : window.innerWidth - 74,
            width: 26,
            height: 26,
            opacity: 0,
            borderRadius: 999,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.68, ease: [0.32, 0.9, 0.3, 1] }}
        />
      ) : null}
    </AnimatePresence>
  );
}
