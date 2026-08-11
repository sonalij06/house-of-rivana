import Link from "next/link";
import { cn } from "@/lib/utils";

/** Page title row. Dense, no motion — the admin optimises for reading speed. */
export function AdminHeader({
  title,
  description,
  children,
  back,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-7 border-b border-hairline pb-5">
      {back ? (
        <Link
          href={back.href}
          className="mb-2 inline-block text-[0.625rem] uppercase tracking-[0.16em] text-muted transition-colors hover:text-gold"
        >
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-none text-ink">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </header>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  padded = true,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("border border-hairline bg-surface", className)}>
      {title ? (
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5">
          <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ink">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}

/** Big number with an optional delta, used across the dashboard. */
export function StatCard({
  label,
  value,
  hint,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: { value: number; suffix?: string };
  tone?: "neutral" | "gold" | "danger";
}) {
  return (
    <div className="border border-hairline bg-surface p-5">
      <p className="text-[0.5625rem] uppercase tracking-[0.18em] text-muted-light">
        {label}
      </p>
      <p
        className={cn(
          "mt-2.5 font-display text-[1.75rem] leading-none tabular-nums",
          tone === "gold" && "text-gold",
          tone === "danger" && "text-danger",
          tone === "neutral" && "text-ink",
        )}
      >
        {value}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        {delta ? (
          <span
            className={cn(
              "text-[0.6875rem] tabular-nums",
              delta.value > 0 ? "text-success" : delta.value < 0 ? "text-danger" : "text-muted",
            )}
          >
            {delta.value > 0 ? "▲" : delta.value < 0 ? "▼" : "→"}{" "}
            {Math.abs(delta.value).toFixed(1)}
            {delta.suffix ?? "%"}
          </span>
        ) : null}
        {hint ? <span className="text-[0.6875rem] text-muted-light">{hint}</span> : null}
      </div>
    </div>
  );
}

export function DataTable({
  head,
  children,
  empty,
  /** Narrower panels (dashboard cards) need a smaller floor than full pages. */
  minWidth = "40rem",
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
  empty?: string;
  minWidth?: string;
}) {
  const isEmpty = Array.isArray(children) ? children.length === 0 : !children;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-hairline">
            {head.map((cell, index) => (
              <th
                key={index}
                scope="col"
                className={cn(
                  "px-5 py-3 text-left text-[0.5625rem] font-medium uppercase tracking-[0.16em] text-muted-light",
                  index === head.length - 1 && "text-right",
                )}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {isEmpty ? (
            <tr>
              <td
                colSpan={head.length}
                className="px-5 py-12 text-center text-sm text-muted"
              >
                {empty ?? "Nothing here yet."}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-5 py-3.5 align-middle",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Coloured pill for order, payment and shipment states. */
export function StatusPill({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[0.625rem] uppercase tracking-[0.1em]",
        tone === "success" && "bg-success-soft text-success",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "info" && "bg-info-soft text-info",
        tone === "neutral" && "bg-cream-dark text-muted",
      )}
    >
      {label ?? status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> =
  {
    PENDING_PAYMENT: "warning",
    PAYMENT_UNDER_REVIEW: "warning",
    UNDER_REVIEW: "warning",
    PENDING: "warning",
    AWAITING_CONFIRMATION: "warning",
    RETURN_REQUESTED: "warning",
    CONFIRMED: "success",
    PAID: "success",
    DELIVERED: "success",
    APPROVED: "success",
    PROCESSING: "info",
    PACKED: "info",
    SHIPPED: "info",
    IN_TRANSIT: "info",
    OUT_FOR_DELIVERY: "info",
    PICKED_UP: "info",
    CANCELLED: "danger",
    FAILED: "danger",
    REJECTED: "danger",
    FAILED_ATTEMPT: "danger",
    EXPIRED: "neutral",
    REFUNDED: "neutral",
    PARTIALLY_REFUNDED: "neutral",
    RETURNED: "neutral",
    RETURNED_TO_ORIGIN: "neutral",
    LABEL_CREATED: "neutral",
    INITIATED: "neutral",
  };
