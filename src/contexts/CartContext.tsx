import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CartLine, ShopProduct } from '../types/shop';
import { maxQuantityFor } from '../services/shopService';

const STORAGE_KEY = 'boxed2built.store.cart';

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: ShopProduct, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  /** Swaps in lines refreshed from the catalog (see syncCartLines). */
  replaceLines: (lines: CartLine[]) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

function readStoredCart(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is CartLine =>
        !!line &&
        typeof line.productId === 'string' &&
        typeof line.priceCents === 'number' &&
        typeof line.quantity === 'number' &&
        line.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Start empty so the prerendered markup and first client render agree, then
  // hydrate from localStorage once mounted.
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setLines(readStoredCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Private-mode storage failures are not worth interrupting checkout over.
    }
  }, [lines, hydrated]);

  const addItem = useCallback((product: ShopProduct, quantity = 1) => {
    const cap = maxQuantityFor(product);
    if (cap <= 0) return;

    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: Math.min(line.quantity + quantity, cap) }
            : line,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          priceCents: product.price_cents,
          imageUrl: product.image_url,
          quantity: Math.min(quantity, cap),
          maxPerOrder: cap,
          requiresShipping: product.requires_shipping,
        },
      ];
    });
    setIsOpen(true);
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.productId !== productId)
        : current.map((line) =>
            line.productId === productId
              ? { ...line, quantity: Math.min(quantity, line.maxPerOrder) }
              : line,
          ),
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }, []);

  const replaceLines = useCallback((next: CartLine[]) => setLines(next), []);

  const clearCart = useCallback(() => setLines([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );

  const value = useMemo(
    () => ({
      lines,
      itemCount,
      isOpen,
      openCart,
      closeCart,
      addItem,
      setQuantity,
      removeItem,
      replaceLines,
      clearCart,
    }),
    [
      lines,
      itemCount,
      isOpen,
      openCart,
      closeCart,
      addItem,
      setQuantity,
      removeItem,
      replaceLines,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Cart access for components that render on both store and non-store pages.
 * Returns null outside the provider (admin/portal routes) so the header can
 * render its Store button without a cart badge.
 */
export function useCartOptional(): CartContextValue | null {
  return useContext(CartContext) ?? null;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
