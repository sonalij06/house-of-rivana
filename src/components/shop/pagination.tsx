import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildShopQuery, type RawSearchParams } from "@/lib/shop-params";
import { cn } from "@/lib/utils";

/**
 * Links rather than buttons, so pages are crawlable and openable in a new tab.
 */
export function Pagination({
  page,
  pageCount,
  basePath,
  searchParams,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  searchParams: RawSearchParams;
}) {
  if (pageCount <= 1) return null;

  const flat = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value == null) continue;
    flat.set(key, Array.isArray(value) ? value.join(",") : value);
  }

  const href = (target: number) => {
    const query = buildShopQuery(flat, { page: target > 1 ? String(target) : null }, {
      keepPage: true,
    });
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <nav
      aria-label="Pagination"
      className="mt-16 flex items-center justify-center gap-1.5 border-t border-hairline pt-10"
    >
      <PageArrow href={page > 1 ? href(page - 1) : undefined} label="Previous page">
        <ChevronLeft className="size-4" strokeWidth={1.6} />
      </PageArrow>

      {pageWindow(page, pageCount).map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="px-1.5 text-xs text-muted-light">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={href(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={cn(
              "flex size-9 items-center justify-center text-xs tabular-nums transition-colors",
              entry === page
                ? "bg-ink text-cream"
                : "border border-hairline text-muted hover:border-ink hover:text-ink",
            )}
          >
            {entry}
          </Link>
        ),
      )}

      <PageArrow href={page < pageCount ? href(page + 1) : undefined} label="Next page">
        <ChevronRight className="size-4" strokeWidth={1.6} />
      </PageArrow>
    </nav>
  );
}

function PageArrow({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span
        aria-hidden
        className="flex size-9 items-center justify-center border border-hairline text-hairline"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-9 items-center justify-center border border-hairline text-muted transition-colors hover:border-ink hover:text-ink"
    >
      {children}
    </Link>
  );
}

/** First, last, and a window around the current page; the rest collapse to "…". */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);

  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push("gap");
    out.push(p);
    previous = p;
  }
  return out;
}
