/**
 * Client-safe catalog query shapes. Lives apart from src/lib/catalog.ts so the
 * filter UI can import these types without dragging Prisma into the browser.
 */

export type SortKey =
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "bestselling"
  | "rating";

export type ShopFilters = {
  collection?: string;
  metals?: string[];
  gemstone?: string;
  minPaise?: number;
  maxPaise?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  search?: string;
  sort?: SortKey;
  page?: number;
  perPage?: number;
};

export type ShopFacets = {
  metals: { value: string; count: number }[];
  minPaise: number;
  maxPaise: number;
  gemstones: string[];
};
