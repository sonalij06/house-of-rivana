"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionProps,
  type Variants,
} from "motion/react";
import { cn } from "@/lib/utils";

/** Shared timing so every reveal on the site moves with the same signature. */
export const EASE_EXPO = [0.16, 1, 0.3, 1] as const;
export const EASE_SOFT = [0.33, 1, 0.68, 1] as const;

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE_EXPO },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: EASE_SOFT } },
};

export const staggerParent = (stagger = 0.08, delay = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  as?: ElementType;
  delay?: number;
  distance?: number;
  once?: boolean;
  amount?: number;
};

/** Fades and lifts an element the first time it scrolls into view. */
export function Reveal({
  children,
  className,
  as = "div",
  delay = 0,
  distance = 24,
  once = true,
  amount = 0.2,
}: RevealProps) {
  const Component = motion[as as keyof typeof motion] as typeof motion.div;
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once, amount, margin: "120px 0px" });
  // Failsafe: never leave content invisible if IntersectionObserver misses.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (inView) setShown(true);
  }, [inView]);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Component
      ref={ref as never}
      className={className}
      initial={false}
      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
      transition={{ duration: 0.7, ease: EASE_EXPO, delay }}
    >
      {children}
    </Component>
  );
}

/**
 * Wraps a list so children animate in sequence. Children should be
 * `<StaggerItem>` or any element with `variants={fadeRise}`.
 */
export function StaggerGroup({
  children,
  className,
  stagger = 0.08,
  delay = 0,
  once = true,
  amount = 0.1,
  as = "div",
}: RevealProps & { stagger?: number }) {
  const Component = motion[as as keyof typeof motion] as typeof motion.div;
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once, amount, margin: "160px 0px" });
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (inView) setShown(true);
  }, [inView]);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Component
      ref={ref as never}
      className={className}
      variants={staggerParent(stagger, delay)}
      initial="hidden"
      animate={shown ? "visible" : "hidden"}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  as?: ElementType;
} & MotionProps) {
  const Component = motion[as as keyof typeof motion] as typeof motion.div;
  return (
    <Component className={className} variants={fadeRise} {...rest}>
      {children}
    </Component>
  );
}

/**
 * Reveals a headline word by word from behind a clipping mask, which reads as
 * typesetting rather than as a web animation.
 */
export function SplitText({
  text,
  className,
  wordClassName,
  as: Tag = "h2",
  delay = 0,
  stagger = 0.055,
  once = true,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  as?: ElementType;
  delay?: number;
  stagger?: number;
  once?: boolean;
}) {
  const words = text.split(" ");
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once, amount: 0.3, margin: "120px 0px" });
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (inView) setShown(true);
  }, [inView]);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Tag className={className}>
      <motion.span
        ref={ref}
        className="inline"
        initial="hidden"
        animate={shown ? "visible" : "hidden"}
        variants={staggerParent(stagger, delay)}
        aria-label={text}
      >
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            className="inline-block overflow-hidden align-bottom"
            aria-hidden
          >
            <motion.span
              className={cn("inline-block", wordClassName)}
              variants={{
                hidden: { y: "110%", opacity: 0 },
                visible: {
                  y: "0%",
                  opacity: 1,
                  transition: { duration: 0.85, ease: EASE_EXPO },
                },
              }}
            >
              {word}
              {i < words.length - 1 ? "\u00A0" : ""}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}

/** Moves content at a different rate to the page as it scrolls past. */
export function Parallax({
  children,
  className,
  offset = 60,
}: {
  children: React.ReactNode;
  className?: string;
  offset?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);
  const smoothY = useSpring(y, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <div ref={ref} className={cn("relative", className)}>
      <motion.div style={{ y: smoothY }} className="h-full w-full">
        {children}
      </motion.div>
    </div>
  );
}

/** Button that leans very slightly toward the cursor. Pointer-fine only. */
export function MagneticButton({
  children,
  className,
  strength = 6,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
} & React.ComponentPropsWithoutRef<"button">) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 22 });
  const springY = useSpring(y, { stiffness: 260, damping: 22 });

  function handleMove(event: React.MouseEvent<HTMLButtonElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width - 0.5;
    const relY = (event.clientY - rect.top) / rect.height - 0.5;
    x.set(relX * strength * 2);
    y.set(relY * strength * 2);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.button
      ref={ref}
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      {...(rest as MotionProps & React.ComponentPropsWithoutRef<"button">)}
    >
      {children}
    </motion.button>
  );
}

/** Counts up to a number once visible — used on the admin dashboard. */
export function CountUp({
  value,
  format,
  className,
  duration = 1.1,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;

    // Reduced motion runs a zero-length animation, which lands on the final
    // value on the first frame instead of tweening to it.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = reduced ? 0 : duration * 1000;

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = total === 0 ? 1 : Math.min(1, (now - start) / total);
      // Ease-out cubic so the number decelerates into place.
      setDisplay(value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {format ? format(display) : Math.round(display).toLocaleString("en-IN")}
    </span>
  );
}

/** Infinite horizontal ticker, duplicated so the loop has no visible seam. */
export function Marquee({
  children,
  className,
  speed = 32,
}: {
  children: React.ReactNode;
  className?: string;
  speed?: number;
}) {
  return (
    <div className={cn("group relative overflow-hidden", className)}>
      <div
        className="flex w-max group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ animation: `marquee ${speed}s linear infinite` }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Soft fade between storefront route segments. Starts visible (`initial={false}`)
 * so a missed client hydration never leaves the whole page at opacity 0.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_EXPO }}
    >
      {children}
    </motion.div>
  );
}
