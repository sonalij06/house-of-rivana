"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { metalLabel } from "@/lib/product";
import { activeFilterCount, buildShopQuery, SORT_OPTIONS } from "@/lib/shop-params";
import type { ShopFacets, ShopFilters } from "@/lib/catalog-types";
import { cn, formatPaise, paiseToRupees } from "@/lib/utils";

type Collection = { slug: string; name: string; count: number };

/**
 * Filters are URL state, not component state: every control pushes a new query
 * string and the server re-queries. That keeps results shareable and the back
 * button meaningful, at the cost of a round trip per change.
 */
function useFilterNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "/shop";
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function apply(patch: Record<string, string | string[] | null>) {
    const query = buildShopQuery(new URLSearchParams(searchParams?.toString() ?? ""), patch);
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return { apply, isPending, searchParams, pathname };
}

export function FilterPanel({
  filters,
  facets,
  collections,
  showCollections = true,
}: {
  filters: ShopFilters;
  facets: ShopFacets;
  collections: Collection[];
  showCollections?: boolean;
}) {
  const { apply, isPending } = useFilterNav();
  const selectedMetals = filters.metals ?? [];

  function toggleMetal(value: string) {
    const next = selectedMetals.includes(value)
      ? selectedMetals.filter((m) => m !== value)
      : [...selectedMetals, value];
    apply({ metal: next.length ? next : null });
  }

  return (
    <div className="relative space-y-9">
      {isPending ? (
        <div className="absolute -top-1 right-0 text-muted-light">
          <Spinner className="size-3.5" />
        </div>
      ) : null}

      {showCollections ? (
        <FilterGroup label="Collection">
          <ul className="space-y-2">
            <li>
              <FilterLink
                active={!filters.collection}
                onClick={() => apply({ collection: null })}
              >
                All jewellery
              </FilterLink>
            </li>
            {collections.map((collection) => (
              <li key={collection.slug}>
                <FilterLink
                  active={filters.collection === collection.slug}
                  count={collection.count}
                  onClick={() =>
                    apply({
                      collection:
                        filters.collection === collection.slug ? null : collection.slug,
                    })
                  }
                >
                  {collection.name}
                </FilterLink>
              </li>
            ))}
          </ul>
        </FilterGroup>
      ) : null}

      <FilterGroup label="Finish">
        <ul className="space-y-2.5">
          {facets.metals.map((metal) => (
            <li key={metal.value}>
              <CheckRow
                checked={selectedMetals.includes(metal.value)}
                count={metal.count}
                onChange={() => toggleMetal(metal.value)}
              >
                {metalLabel(metal.value)}
              </CheckRow>
            </li>
          ))}
        </ul>
      </FilterGroup>

      {facets.gemstones.length ? (
        <FilterGroup label="Stone">
          <div className="flex flex-wrap gap-2">
            {facets.gemstones.map((gemstone) => {
              const active = filters.gemstone === gemstone;
              return (
                <button
                  key={gemstone}
                  type="button"
                  onClick={() => apply({ gemstone: active ? null : gemstone })}
                  aria-pressed={active}
                  className={cn(
                    "border px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] transition-colors",
                    active
                      ? "border-ink bg-ink text-cream"
                      : "border-hairline text-muted hover:border-ink hover:text-ink",
                  )}
                >
                  {gemstone}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      ) : null}

      {/* Keyed on the URL range so clearing filters elsewhere remounts the
          inputs with the new values instead of syncing them in an effect. */}
      <PriceFilter
        key={`${filters.minPaise ?? ""}-${filters.maxPaise ?? ""}`}
        filters={filters}
        facets={facets}
        onApply={apply}
      />

      <FilterGroup label="Availability">
        <ul className="space-y-2.5">
          <li>
            <CheckRow
              checked={Boolean(filters.inStockOnly)}
              onChange={() => apply({ stock: filters.inStockOnly ? null : "1" })}
            >
              In stock only
            </CheckRow>
          </li>
          <li>
            <CheckRow
              checked={Boolean(filters.onSaleOnly)}
              onChange={() => apply({ sale: filters.onSaleOnly ? null : "1" })}
            >
              On offer
            </CheckRow>
          </li>
        </ul>
      </FilterGroup>
    </div>
  );
}

function PriceFilter({
  filters,
  facets,
  onApply,
}: {
  filters: ShopFilters;
  facets: ShopFacets;
  onApply: (patch: Record<string, string | string[] | null>) => void;
}) {
  const floor = Math.floor(paiseToRupees(facets.minPaise));
  const ceiling = Math.ceil(paiseToRupees(facets.maxPaise));
  const [min, setMin] = useState(
    filters.minPaise != null ? String(paiseToRupees(filters.minPaise)) : "",
  );
  const [max, setMax] = useState(
    filters.maxPaise != null ? String(paiseToRupees(filters.maxPaise)) : "",
  );

  const bands = buildPriceBands(floor, ceiling);

  return (
    <FilterGroup label="Price">
      <ul className="space-y-2">
        {bands.map((band) => {
          const active =
            filters.minPaise === band.minPaise && filters.maxPaise === band.maxPaise;
          return (
            <li key={band.label}>
              <FilterLink
                active={active}
                onClick={() =>
                  onApply({
                    min: active || band.minPaise == null ? null : String(band.minPaise / 100),
                    max: active || band.maxPaise == null ? null : String(band.maxPaise / 100),
                  })
                }
              >
                {band.label}
              </FilterLink>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onApply({ min: min || null, max: max || null });
        }}
      >
        <PriceInput value={min} onChange={setMin} placeholder={String(floor)} label="Minimum price" />
        <span className="text-xs text-muted-light">–</span>
        <PriceInput value={max} onChange={setMax} placeholder={String(ceiling)} label="Maximum price" />
        <button
          type="submit"
          className="h-9 shrink-0 border border-hairline px-3 text-[0.625rem] uppercase tracking-[0.14em] text-muted transition-colors hover:border-ink hover:text-ink"
        >
          Go
        </button>
      </form>
    </FilterGroup>
  );
}

function buildPriceBands(floor: number, ceiling: number) {
  // Round thresholds outward to the nearest ₹1,000 so the labels read cleanly
  // regardless of the actual catalogue min/max.
  const span = Math.max(1000, ceiling - floor);
  const step = Math.ceil(span / 3 / 1000) * 1000;
  const first = floor + step;
  const second = first + step;

  return [
    { label: `Under ${formatPaise(first * 100)}`, minPaise: null, maxPaise: first * 100 },
    {
      label: `${formatPaise(first * 100)} – ${formatPaise(second * 100)}`,
      minPaise: first * 100,
      maxPaise: second * 100,
    },
    { label: `${formatPaise(second * 100)} and above`, minPaise: second * 100, maxPaise: null },
  ] as { label: string; minPaise: number | null; maxPaise: number | null }[];
}

function PriceInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="relative min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-light">
        ₹
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
        className="h-9 w-full border border-hairline bg-surface pl-6 pr-2 text-xs tabular-nums text-ink outline-none transition-colors placeholder:text-muted-light focus:border-gold"
      />
    </label>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3.5 font-sans text-[0.625rem] font-medium uppercase tracking-[0.18em] text-ink">
        {label}
      </h3>
      {children}
    </section>
  );
}

function FilterLink({
  children,
  active,
  count,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group flex w-full items-baseline justify-between gap-3 text-left text-sm transition-colors",
        active ? "text-gold" : "text-muted hover:text-ink",
      )}
    >
      <span className={cn("rule-wipe", active && "font-medium")} data-active={active}>
        {children}
      </span>
      {count != null ? (
        <span className="shrink-0 text-[0.625rem] tabular-nums text-muted-light">{count}</span>
      ) : null}
    </button>
  );
}

function CheckRow({
  children,
  checked,
  count,
  onChange,
}: {
  children: React.ReactNode;
  checked: boolean;
  count?: number;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted transition-colors hover:text-ink">
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center border transition-colors",
          checked ? "border-gold bg-gold text-cream" : "border-hairline bg-surface",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={2.4} /> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span className={cn("flex-1", checked && "text-ink")}>{children}</span>
      {count != null ? (
        <span className="text-[0.625rem] tabular-nums text-muted-light">{count}</span>
      ) : null}
    </label>
  );
}

/** Chips summarising what is filtered, each removable in one tap. */
export function ActiveFilterChips({ filters }: { filters: ShopFilters }) {
  const { apply } = useFilterNav();
  const chips: { label: string; clear: Record<string, null> }[] = [];

  for (const metal of filters.metals ?? []) {
    chips.push({ label: metalLabel(metal), clear: { metal: null } });
  }
  if (filters.gemstone) chips.push({ label: filters.gemstone, clear: { gemstone: null } });
  if (filters.minPaise != null || filters.maxPaise != null) {
    chips.push({
      label:
        filters.minPaise != null && filters.maxPaise != null
          ? `${formatPaise(filters.minPaise)} – ${formatPaise(filters.maxPaise)}`
          : filters.minPaise != null
            ? `Above ${formatPaise(filters.minPaise)}`
            : `Under ${formatPaise(filters.maxPaise!)}`,
      clear: { min: null, max: null },
    });
  }
  if (filters.inStockOnly) chips.push({ label: "In stock", clear: { stock: null } });
  if (filters.onSaleOnly) chips.push({ label: "On offer", clear: { sale: null } });

  if (!chips.length) return null;

  return (
    <motion.div
      className="flex flex-wrap items-center gap-2"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={() => apply(chip.clear)}
          className="flex items-center gap-1.5 border border-hairline bg-surface px-2.5 py-1 text-[0.6875rem] text-muted transition-colors hover:border-ink hover:text-ink"
        >
          {chip.label}
          <X className="size-3" strokeWidth={1.8} />
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          apply({ metal: null, gemstone: null, min: null, max: null, stock: null, sale: null })
        }
        className="text-[0.6875rem] uppercase tracking-[0.12em] text-gold underline-offset-4 hover:underline"
      >
        Clear all
      </button>
    </motion.div>
  );
}

export function SortSelect({ sort }: { sort: string }) {
  const { apply } = useFilterNav();
  return (
    <label className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-[0.14em] text-muted-light">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={sort}
        onChange={(event) => apply({ sort: event.target.value })}
        className="h-9 border border-hairline bg-surface px-2.5 text-[0.6875rem] uppercase tracking-[0.12em] text-ink outline-none transition-colors focus:border-gold"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The same filter panel in a slide-over, for viewports without a sidebar. */
export function MobileFilterButton({
  filters,
  facets,
  collections,
  showCollections = true,
}: {
  filters: ShopFilters;
  facets: ShopFacets;
  collections: Collection[];
  showCollections?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 border border-hairline px-3 text-[0.6875rem] uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink lg:hidden"
      >
        <SlidersHorizontal className="size-3.5" strokeWidth={1.6} />
        Filter
        {count ? (
          <span className="flex size-4 items-center justify-center rounded-full bg-gold text-[0.5625rem] text-cream">
            {count}
          </span>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <Sheet side="left" title="Filter" description="Narrow the collection">
          <div className="px-5 pb-10 pt-4">
            <FilterPanel
              filters={filters}
              facets={facets}
              collections={collections}
              showCollections={showCollections}
            />
          </div>
        </Sheet>
      </Dialog>
    </>
  );
}
