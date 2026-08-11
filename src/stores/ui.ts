"use client";

import { create } from "zustand";

type Rect = { top: number; left: number; width: number; height: number };

type FlyPayload = {
  imageUrl: string;
  rect: Rect;
  key: number;
};

/**
 * Where a product card was on screen when it was clicked, so the detail page can
 * FLIP its hero image out of that position. Cleared once consumed, and stale
 * after ~1s because a slow navigation should just cut instead of jumping.
 */
type ProductOrigin = { slug: string; rect: Rect; at: number };

type UIState = {
  cartOpen: boolean;
  mobileNavOpen: boolean;
  searchOpen: boolean;
  /** Bumped on every successful add so the bag icon can react. */
  bumpToken: number;
  /** Drives the ghost image that flies from the product card to the bag. */
  fly: FlyPayload | null;
  productOrigin: ProductOrigin | null;

  openCart: () => void;
  closeCart: () => void;
  setCartOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  bump: () => void;
  flyToCart: (imageUrl: string, rect: DOMRect) => void;
  clearFly: () => void;
  setProductOrigin: (slug: string, rect: DOMRect) => void;
  takeProductOrigin: (slug: string) => Rect | null;
};

export const useUIStore = create<UIState>((set, get) => ({
  cartOpen: false,
  mobileNavOpen: false,
  searchOpen: false,
  bumpToken: 0,
  fly: null,
  productOrigin: null,

  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),
  setCartOpen: (open) => set({ cartOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  bump: () => set((s) => ({ bumpToken: s.bumpToken + 1 })),
  flyToCart: (imageUrl, rect) =>
    set({
      fly: {
        imageUrl,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
        key: Date.now(),
      },
    }),
  clearFly: () => set({ fly: null }),

  setProductOrigin: (slug, rect) =>
    set({
      productOrigin: {
        slug,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
        at: Date.now(),
      },
    }),

  takeProductOrigin: (slug) => {
    const origin = get().productOrigin;
    if (!origin || origin.slug !== slug || Date.now() - origin.at > 1000) return null;
    set({ productOrigin: null });
    return origin.rect;
  },
}));
