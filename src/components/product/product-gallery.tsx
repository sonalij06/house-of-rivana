"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { useUIStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

export type GalleryImage = {
  id: string;
  url: string;
  alt: string;
  blurDataUrl: string | null;
};

const ZOOM = 2.1;

/**
 * Vertical thumbnail rail plus a hover magnifier. The lens is a second copy of
 * the image scaled up and offset by the cursor position — cheap, and sharper
 * than a CSS transform on the original because next/image serves it at full size.
 */
export function ProductGallery({
  images,
  productName,
  slug,
}: {
  images: GalleryImage[];
  productName: string;
  /** Used to claim the originating thumbnail's position for the entrance morph. */
  slug?: string;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const frameRef = scope;
  const takeProductOrigin = useUIStore((state) => state.takeProductOrigin);

  /**
   * FLIP: the grid thumbnail's rect is handed over on click, so the hero starts
   * transformed onto that rect and animates back to identity. Cross-route
   * layout animation isn't possible in the App Router, and this is
   * indistinguishable from one.
   */
  useLayoutEffect(() => {
    if (!slug) return;
    const from = takeProductOrigin(slug);
    const frame = scope.current;
    if (!from || !frame) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const to = frame.getBoundingClientRect();
    if (!to.width || !to.height) return;

    const scale = from.width / to.width;
    const x = from.left - to.left;
    const y = from.top - to.top;

    animate(
      frame,
      { x: [x, 0], y: [y, 0], scale: [scale, 1] },
      { duration: 0.62, ease: [0.16, 1, 0.3, 1] },
    );
  }, [slug, takeProductOrigin, animate, scope]);

  const active = images[index] ?? images[0];
  const count = images.length;

  const step = useCallback(
    (delta: number) => setIndex((i) => (i + delta + count) % count),
    [count],
  );

  useEffect(() => {
    if (!lightbox) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLightbox(false);
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, step]);

  function trackLens(event: React.MouseEvent<HTMLDivElement>) {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    setLens({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  if (!active) {
    return <div className="aspect-square w-full bg-cream-dark" aria-hidden />;
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row-reverse md:gap-5">
      <div className="min-w-0 flex-1">
        <div
          ref={frameRef}
          className="group relative aspect-square w-full cursor-zoom-in overflow-hidden bg-cream-dark"
          // Top-left origin keeps the FLIP maths above honest.
          style={{ transformOrigin: "top left" }}
          onMouseMove={trackLens}
          onMouseLeave={() => setLens(null)}
          onClick={() => setLightbox(true)}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={active.id}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <SafeImage
                src={active.url}
                alt={active.alt || productName}
                fill
                priority={index === 0}
                sizes="(max-width: 768px) 100vw, 46vw"
                placeholder={active.blurDataUrl ? "blur" : undefined}
                blurDataURL={active.blurDataUrl ?? undefined}
                className="object-cover"
              />
            </motion.div>
          </AnimatePresence>

          {/* Magnifier: desktop pointers only, and never during reduced motion. */}
          {lens ? (
            <div
              className="pointer-events-none absolute inset-0 hidden motion-safe:md:block"
              style={{
                backgroundImage: `url(${active.url})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${ZOOM * 100}% ${ZOOM * 100}%`,
                backgroundPosition: `${lens.x}% ${lens.y}%`,
              }}
              aria-hidden
            />
          ) : null}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setLightbox(true);
            }}
            aria-label="View larger"
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-cream/85 text-ink backdrop-blur-sm transition-opacity hover:bg-cream md:opacity-0 md:group-hover:opacity-100"
          >
            <Expand className="size-3.5" strokeWidth={1.6} />
          </button>

          {count > 1 ? (
            <>
              <GalleryArrow side="left" onClick={() => step(-1)} />
              <GalleryArrow side="right" onClick={() => step(1)} />
              <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 bg-cream/85 px-2.5 py-1 text-[0.625rem] tabular-nums tracking-[0.14em] text-ink backdrop-blur-sm md:hidden">
                {index + 1} / {count}
              </p>
            </>
          ) : null}
        </div>
      </div>

      {count > 1 ? (
        <div
          className="flex shrink-0 gap-3 overflow-x-auto pb-1 no-scrollbar md:w-20 md:flex-col md:overflow-visible md:pb-0"
          role="tablist"
          aria-label={`${productName} images`}
        >
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Image ${i + 1}`}
              onClick={() => setIndex(i)}
              onMouseEnter={() => setIndex(i)}
              className={cn(
                "relative aspect-square w-16 shrink-0 overflow-hidden bg-cream-dark transition-all duration-300 md:w-full",
                i === index
                  ? "ring-1 ring-gold ring-offset-2 ring-offset-cream"
                  : "opacity-65 hover:opacity-100",
              )}
            >
              <SafeImage
                src={image.url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      <AnimatePresence>
        {lightbox ? (
          <motion.div
            className="fixed inset-0 z-60 flex items-center justify-center bg-ink/94 p-4 md:p-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setLightbox(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`${productName} — enlarged image`}
          >
            <button
              type="button"
              onClick={() => setLightbox(false)}
              aria-label="Close"
              className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-full border border-cream/25 text-cream transition-colors hover:bg-cream hover:text-ink"
            >
              <X className="size-4" strokeWidth={1.6} />
            </button>

            <motion.div
              className="relative h-full max-h-[86vh] w-full max-w-4xl"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <SafeImage
                src={active.url}
                alt={active.alt || productName}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </motion.div>

            {count > 1 ? (
              <div
                className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 text-cream"
                onClick={(event) => event.stopPropagation()}
              >
                <button type="button" onClick={() => step(-1)} aria-label="Previous image">
                  <ChevronLeft className="size-5" strokeWidth={1.5} />
                </button>
                <span className="text-xs tabular-nums tracking-[0.16em]">
                  {index + 1} / {count}
                </span>
                <button type="button" onClick={() => step(1)} aria-label="Next image">
                  <ChevronRight className="size-5" strokeWidth={1.5} />
                </button>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function GalleryArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn(
        "absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-cream/85 text-ink backdrop-blur-sm transition-opacity hover:bg-cream md:opacity-0 md:group-hover:opacity-100",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="size-4" strokeWidth={1.6} />
      ) : (
        <ChevronRight className="size-4" strokeWidth={1.6} />
      )}
    </button>
  );
}
