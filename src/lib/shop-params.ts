import type { ShopFilters, SortKey } from "@/lib/catalog-types";

/**
 * Single source of truth for the /shop query string, shared by the server page
 * (which reads it) and the filter UI (which writes it). Prices travel as rupees
 * so URLs stay human-readable; everything internal works in paise.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "New arrivals" },
  { value: "bestselling", label: "Bestselling" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
];

const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value));

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toList(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toRupees(value: string | string[] | undefined) {
  const raw = first(value);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parseShopParams(params: RawSearchParams, perPage = 12): ShopFilters {
  const sort = first(params.sort);
  const minRupees = toRupees(params.min);
  const maxRupees = toRupees(params.max);
  const page = Number.parseInt(first(params.page) ?? "1", 10);

  return {
    collection: first(params.collection) || undefined,
    metals: toList(params.metal),
    gemstone: first(params.gemstone) || undefined,
    minPaise: minRupees != null ? minRupees * 100 : undefined,
    maxPaise: maxRupees != null ? maxRupees * 100 : undefined,
    inStockOnly: first(params.stock) === "1",
    onSaleOnly: first(params.sale) === "1",
    search: first(params.q)?.trim() || undefined,
    sort: sort && SORT_VALUES.has(sort as SortKey) ? (sort as SortKey) : "featured",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    perPage,
  };
}

/** Rebuilds the query string from a filter patch, resetting pagination. */
export function buildShopQuery(
  current: URLSearchParams,
  patch: Record<string, string | string[] | null>,
  options: { keepPage?: boolean } = {},
) {
  const next = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(patch)) {
    next.delete(key);
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.length) next.set(key, value.join(","));
    } else if (value !== "") {
      next.set(key, value);
    }
  }

  if (!options.keepPage) next.delete("page");
  return next.toString();
}

export function activeFilterCount(filters: ShopFilters) {
  return (
    (filters.metals?.length ?? 0) +
    (filters.gemstone ? 1 : 0) +
    (filters.minPaise != null ? 1 : 0) +
    (filters.maxPaise != null ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.onSaleOnly ? 1 : 0)
  );
}
