import { BrandLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type BrandLoadingProps = {
  className?: string;
  /** Logo diameter in pixels. */
  size?: number;
  label?: string;
};

/**
 * Centered brand mark used as the route / segment loading state.
 */
export function BrandLoading({
  className,
  size = 168,
  label = "Loading",
}: BrandLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex min-h-[55dvh] flex-1 items-center justify-center py-24",
        className,
      )}
    >
      <span className="animate-logo-breathe inline-flex">
        <BrandLogo
          href={null}
          size={size}
          priority
          framed={false}
          className="ring-1 ring-hairline/35"
        />
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
