"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Client-side cart mirror. The Cart table (keyed by userId or guest cookie) is
 * the source of truth for totals and stock; this store keeps a lightweight
 * guest-persisted hint so the bag count and drawer can feel instant between
 * navigations, and so a merge-on-login path has a local list to reconcile.
 */

export type GuestCartLine = {
  variantId: string;
  quantity: number;
  productId?: string;
  slug?: string;
  name?: string;
  variantLabel?: string;
  imageUrl?: string | null;
  unitPricePaise?: number;
};

type CartState = {
  guestLines: GuestCartLine[];
  lastServerCount: number;
  setFromServer: (lines: GuestCartLine[], count: number) => void;
  upsertGuestLine: (line: GuestCartLine) => void;
  setGuestQuantity: (variantId: string, quantity: number) => void;
  removeGuestLine: (variantId: string) => void;
  clearGuest: () => void;
  guestCount: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      guestLines: [],
      lastServerCount: 0,

      setFromServer: (lines, count) =>
        set({ guestLines: lines, lastServerCount: count }),

      upsertGuestLine: (line) =>
        set((state) => {
          const existing = state.guestLines.find(
            (l) => l.variantId === line.variantId,
          );
          if (!existing) {
            return { guestLines: [...state.guestLines, line] };
          }
          return {
            guestLines: state.guestLines.map((l) =>
              l.variantId === line.variantId
                ? { ...l, ...line, quantity: line.quantity }
                : l,
            ),
          };
        }),

      setGuestQuantity: (variantId, quantity) =>
        set((state) => ({
          guestLines:
            quantity <= 0
              ? state.guestLines.filter((l) => l.variantId !== variantId)
              : state.guestLines.map((l) =>
                  l.variantId === variantId ? { ...l, quantity } : l,
                ),
        })),

      removeGuestLine: (variantId) =>
        set((state) => ({
          guestLines: state.guestLines.filter((l) => l.variantId !== variantId),
        })),

      clearGuest: () => set({ guestLines: [], lastServerCount: 0 }),

      guestCount: () =>
        get().guestLines.reduce((sum, line) => sum + line.quantity, 0),
    }),
    {
      name: "rivana-guest-cart",
      partialize: (state) => ({ guestLines: state.guestLines }),
    },
  ),
);
