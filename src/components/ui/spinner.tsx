import { cn } from "@/lib/utils";

export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block size-4 animate-[spin_0.9s_linear_infinite] rounded-full border-[1.5px] border-current border-t-transparent",
        className,
      )}
    />
  );
}
