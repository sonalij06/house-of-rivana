import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  count,
  size = "sm",
  showValue = false,
  className,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  showValue?: boolean;
  className?: string;
}) {
  const px = size === "sm" ? "size-3.5" : "size-4";
  const rounded = Math.round(value * 2) / 2;

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      aria-label={`Rated ${value.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ""}`}
    >
      <div className="flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = rounded >= star;
          const half = !filled && rounded >= star - 0.5;
          return (
            <span key={star} className="relative inline-block">
              <Star className={cn(px, "text-champagne-soft")} strokeWidth={1.5} />
              {(filled || half) && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: half ? "50%" : "100%" }}
                >
                  <Star
                    className={cn(px, "fill-gold text-gold")}
                    strokeWidth={1.5}
                  />
                </span>
              )}
            </span>
          );
        })}
      </div>
      {showValue ? (
        <span className="text-xs font-medium text-ink">{value.toFixed(1)}</span>
      ) : null}
      {count != null ? (
        <span className="text-xs text-muted">
          ({count})
        </span>
      ) : null}
    </div>
  );
}
