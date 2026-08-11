import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal, SplitText } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  hrefLabel = "View all",
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-6",
        align === "center" && "flex-col items-center text-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? (
          <Reveal distance={12}>
            <p className="eyebrow text-gold">{eyebrow}</p>
          </Reveal>
        ) : null}
        <SplitText
          text={title}
          as="h2"
          className="mt-3 font-display text-[clamp(1.9rem,4vw,3rem)] text-ink"
        />
        {description ? (
          <Reveal delay={0.1} distance={16}>
            <p className="mt-4 max-w-prose text-[0.9375rem] leading-relaxed text-muted">
              {description}
            </p>
          </Reveal>
        ) : null}
      </div>
      {href ? (
        <Reveal delay={0.15} distance={12}>
          <Link
            href={href}
            className="rule-wipe group inline-flex items-center gap-2 pb-1 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-ink transition-colors hover:text-gold"
          >
            {hrefLabel}
            <ArrowRight className="size-3.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1" />
          </Link>
        </Reveal>
      ) : null}
    </div>
  );
}
