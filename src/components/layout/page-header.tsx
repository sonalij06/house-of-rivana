import { Breadcrumbs, type Crumb } from "@/components/layout/breadcrumbs";
import { Reveal, SplitText } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  crumbs,
  align = "left",
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
  crumbs?: Crumb[];
  align?: "left" | "center";
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "border-b border-hairline pb-9",
        align === "center" && "text-center",
        className,
      )}
    >
      {crumbs?.length ? (
        <Breadcrumbs
          items={crumbs}
          className={cn("mb-7", align === "center" && "flex justify-center")}
        />
      ) : null}

      {eyebrow ? (
        <Reveal>
          <p className="text-[0.6875rem] uppercase tracking-[0.22em] text-gold">
            {eyebrow}
          </p>
        </Reveal>
      ) : null}

      <h1
        className={cn(
          "mt-3 font-display text-[2.25rem] leading-[1.08] text-ink md:text-[3rem]",
          align === "center" && "mx-auto max-w-3xl",
        )}
      >
        <SplitText text={title} as="span" />
      </h1>

      {description ? (
        <Reveal delay={0.12}>
          <p
            className={cn(
              "mt-5 max-w-xl text-sm leading-relaxed text-muted",
              align === "center" && "mx-auto",
            )}
          >
            {description}
          </p>
        </Reveal>
      ) : null}

      {children ? <Reveal delay={0.16}>{children}</Reveal> : null}
    </header>
  );
}
