import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const LOGO_SRC = "/brand/logo.png";

type BrandLogoProps = {
  href?: string | null;
  /** Diameter in pixels for the circular mark. */
  size?: number;
  className?: string;
  priority?: boolean;
  /** Accessible label when used as a link or standalone image. */
  label?: string;
  /** Soft ring so the cream mark separates cleanly on cream backgrounds. */
  framed?: boolean;
};

/**
 * Official House of Rivana circular mark. Prefer this over typeset brand text
 * wherever the lockup appears as a home / identity control.
 */
export function BrandLogo({
  href = "/",
  size = 48,
  className,
  priority = false,
  label = "House of Rivana",
  framed = true,
}: BrandLogoProps) {
  const image = (
    <Image
      src={LOGO_SRC}
      alt={href ? "" : label}
      width={size}
      height={size}
      priority={priority}
      className={cn(
        "rounded-full object-cover",
        framed && "ring-1 ring-hairline/80 ring-offset-2 ring-offset-cream",
        className,
      )}
      sizes={`${size}px`}
    />
  );

  if (!href) {
    return (
      <span className="inline-flex shrink-0" style={{ width: size, height: size }}>
        {image}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={`${label} home`}
      className="inline-flex shrink-0 rounded-full transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      style={{ width: size, height: size }}
    >
      {image}
    </Link>
  );
}

type BrandLockupProps = {
  href?: string;
  size?: number;
  priority?: boolean;
  /** Compact single-line wordmark for tight headers. */
  compact?: boolean;
  className?: string;
  onClick?: () => void;
};

/**
 * Circular mark + typeset wordmark for the storefront header identity.
 */
export function BrandLockup({
  href = "/",
  size = 48,
  priority = false,
  compact = false,
  className,
  onClick,
}: BrandLockupProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label="House of Rivana home"
      className={cn(
        "group/brand inline-flex min-w-0 items-center gap-3 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        className,
      )}
    >
      <span
        className="relative inline-flex shrink-0 overflow-hidden rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/brand:scale-[1.04]"
        style={{ width: size, height: size }}
      >
        <Image
          src={LOGO_SRC}
          alt=""
          width={size}
          height={size}
          priority={priority}
          className="rounded-full object-cover ring-1 ring-hairline/80 ring-offset-2 ring-offset-cream transition-[box-shadow] duration-500 group-hover/brand:ring-gold/35"
          sizes={`${size}px`}
        />
      </span>

      {compact ? (
        <span className="min-w-0 font-display text-[1.2rem] leading-none tracking-[0.04em] text-ink transition-colors duration-300 group-hover/brand:text-gold sm:text-[1.35rem]">
          House of Rivana
        </span>
      ) : (
        <span className="flex min-w-0 flex-col justify-center leading-none">
          <span className="text-[0.625rem] font-medium uppercase tracking-[0.28em] text-muted transition-colors duration-300 group-hover/brand:text-gold">
            House of
          </span>
          <span className="mt-1.5 font-display text-[1.65rem] tracking-[0.08em] text-ink transition-[color,letter-spacing] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/brand:tracking-[0.12em] group-hover/brand:text-gold sm:text-[1.85rem]">
            Rivana
          </span>
        </span>
      )}
    </Link>
  );
}
