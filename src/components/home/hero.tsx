"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { MagneticButton } from "@/components/motion/primitives";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

export type HeroSlideData = {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  blurDataUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  alignment: string;
};

const SLIDE_MS = 7000;

export function Hero({ slides }: { slides: HeroSlideData[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      if (slides.length <= 1) return;
      setIndex((next + slides.length) % slides.length);
    },
    [slides.length],
  );

  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const timer = setTimeout(() => goNext(), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [goNext, paused, slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, slides.length]);

  if (slides.length === 0) return null;
  const slide = slides[index];
  const align = slide.alignment as "left" | "center" | "right";

  return (
    <section
      className="relative h-[86dvh] min-h-[520px] w-full overflow-hidden bg-ink"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured collections"
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={slide.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Slow Ken Burns drift keeps a still photograph alive. */}
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.02, x: 0, y: 0 }}
            animate={{ scale: 1.12, x: "-1.5%", y: "-1%" }}
            transition={{ duration: 14, ease: "linear" }}
          >
            <SafeImage
              src={slide.imageUrl}
              alt={slide.title}
              fill
              priority={index === 0}
              sizes="100vw"
              placeholder={slide.blurDataUrl ? "blur" : undefined}
              blurDataURL={slide.blurDataUrl ?? undefined}
              className="object-cover"
            />
          </motion.div>
          <div className="scrim absolute inset-0" />
        </motion.div>
      </AnimatePresence>

      <div className="container-site relative flex h-full items-end pb-20 md:pb-28">
        <div
          className={cn(
            "max-w-2xl",
            align === "center" && "mx-auto text-center",
            align === "right" && "ml-auto text-right",
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div key={slide.id}>
              {slide.eyebrow ? (
                <motion.p
                  className="text-[0.6875rem] font-medium uppercase tracking-[0.24em] text-champagne"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  {slide.eyebrow}
                </motion.p>
              ) : null}

              <h1 className="mt-4 font-display text-[clamp(2.4rem,6.5vw,4.75rem)] leading-[1.02] text-cream">
                {slide.title.split(" ").map((word, i) => (
                  <span
                    key={`${word}-${i}`}
                    className="inline-block overflow-hidden align-bottom"
                  >
                    <motion.span
                      className="inline-block"
                      initial={{ y: "112%" }}
                      animate={{ y: "0%" }}
                      transition={{
                        duration: 0.95,
                        delay: 0.34 + i * 0.07,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {word}&nbsp;
                    </motion.span>
                  </span>
                ))}
              </h1>

              {slide.subtitle ? (
                <motion.p
                  className={cn(
                    "mt-5 max-w-md text-[0.9375rem] leading-relaxed text-cream/80",
                    align === "center" && "mx-auto",
                    align === "right" && "ml-auto",
                  )}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  {slide.subtitle}
                </motion.p>
              ) : null}

              {slide.ctaHref && slide.ctaLabel ? (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.72, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-9"
                >
                  <MagneticButton
                    type="button"
                    className="group inline-flex h-12 items-center gap-3 bg-cream px-8 text-[0.75rem] font-medium uppercase tracking-[0.18em] text-ink transition-colors hover:bg-champagne"
                    onClick={() => router.push(slide.ctaHref!)}
                  >
                    {slide.ctaLabel}
                    <ArrowRight className="size-3.5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5" />
                  </MagneticButton>
                </motion.div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {slides.length > 1 ? (
        <>
          <HeroArrow
            direction="prev"
            onClick={goPrev}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 sm:left-5 md:left-8"
          />
          <HeroArrow
            direction="next"
            onClick={goNext}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-5 md:right-8"
          />

          <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className="group relative h-[3px] w-10 overflow-hidden bg-cream/25"
              >
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 bg-cream transition-all",
                    i === index ? "w-full" : "w-0 group-hover:w-1/3",
                  )}
                  style={
                    i === index && !paused
                      ? {
                          animation: `hero-progress ${SLIDE_MS}ms linear`,
                        }
                      : undefined
                  }
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function HeroArrow({
  direction,
  onClick,
  className,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  className?: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous slide" : "Next slide"}
      className={cn(
        "flex size-11 items-center justify-center border border-cream/30 bg-ink/25 text-cream backdrop-blur-[2px] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-champagne hover:bg-ink/45 hover:text-champagne focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne/50 md:size-12",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={1.5} />
    </button>
  );
}
