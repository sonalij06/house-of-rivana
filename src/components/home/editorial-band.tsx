import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Parallax, Reveal, SplitText } from "@/components/motion/primitives";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

/** Full-width photo-and-copy band. Alternate `flip` down the page. */
export function EditorialBand({
  eyebrow,
  title,
  body,
  imageUrl,
  href,
  linkLabel,
  flip = false,
  notes,
}: {
  eyebrow: string;
  title: string;
  body: string[];
  imageUrl: string;
  href?: string;
  linkLabel?: string;
  flip?: boolean;
  notes?: { label: string; value: string }[];
}) {
  return (
    <section className="container-site section-y">
      <div
        className={cn(
          "grid items-center gap-10 lg:grid-cols-2 lg:gap-20",
          flip && "lg:[&>*:first-child]:order-2",
        )}
      >
        <Parallax offset={34} className="overflow-hidden">
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-cream-dark">
            <SafeImage
              src={imageUrl}
              alt={title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="scale-[1.12] object-cover"
            />
          </div>
        </Parallax>

        <div className={cn(flip && "lg:pr-10", !flip && "lg:pl-4")}>
          <Reveal distance={14}>
            <p className="eyebrow text-gold">{eyebrow}</p>
          </Reveal>
          <SplitText
            text={title}
            as="h2"
            className="mt-4 font-display text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.06] text-ink"
          />
          <div className="mt-6 space-y-4">
            {body.map((paragraph, i) => (
              <Reveal key={i} delay={0.08 + i * 0.06} distance={16}>
                <p className="text-[0.9375rem] leading-relaxed text-muted">
                  {paragraph}
                </p>
              </Reveal>
            ))}
          </div>

          {notes?.length ? (
            <Reveal delay={0.22}>
              <dl className="mt-8 grid gap-y-4 border-t border-hairline pt-6 sm:grid-cols-3">
                {notes.map((note) => (
                  <div key={note.label}>
                    <dt className="text-[0.625rem] uppercase tracking-[0.16em] text-muted-light">
                      {note.label}
                    </dt>
                    <dd className="mt-1.5 font-display text-xl text-ink">
                      {note.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          ) : null}

          {href && linkLabel ? (
            <Reveal delay={0.26}>
              <Link
                href={href}
                className="group mt-8 inline-flex items-center gap-2.5 border-b border-ink/25 pb-1.5 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-ink transition-colors hover:border-gold hover:text-gold"
              >
                {linkLabel}
                <ArrowRight className="size-3.5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5" />
              </Link>
            </Reveal>
          ) : null}
        </div>
      </div>
    </section>
  );
}
