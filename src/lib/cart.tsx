"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type CartItem = { id: string; name: string; price: number; qty: number };
export type CartState = { items: CartItem[] };
const EMPTY: CartState = { items: [] };

function loadLS(key: string): CartState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return EMPTY;
    return {
      items: parsed.items
        .map((x: any) => ({
          id: String(x.id),
          name: String(x.name),
          price: Number(x.price) || 0,
          qty: Number(x.qty) || 0,
        }))
        .filter((x: CartItem) => x.qty > 0),
    };
  } catch {
    return EMPTY;
  }
}

function saveLS(key: string, state: CartState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(state));
}

function setLastMerchant(merchantId: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("cart:lastMerchant", merchantId);
  }
}

function getLastMerchant(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cart:lastMerchant");
}

/** Hook keranjang per merchant. */
export function useCart(merchantId?: string) {
  const effectiveMerchantId = useMemo(() => {
    if (merchantId) return merchantId;
    if (typeof window !== "undefined") {
      return getLastMerchant() || undefined;
    }
    return undefined;
  }, [merchantId]);

  const cartKey = useMemo(
    () => (effectiveMerchantId ? `cart:${effectiveMerchantId}` : null),
    [effectiveMerchantId]
  );

  const keyRef = useRef<string | null>(null);
  const [state, setState] = useState<CartState>(EMPTY);

  // load from LS when key ready
  useEffect(() => {
    if (!cartKey) return;
    keyRef.current = cartKey;
    setState(loadLS(cartKey));
  }, [cartKey]);

  /** Save synchronously & update lastMerchant. */
  function writeNow(next: CartState) {
    const key = keyRef.current;
    if (!key) return;
    saveLS(key, next);
    const merchant = key.replace(/^cart:/, "");
    if (next.items.length > 0) setLastMerchant(merchant);
  }

  // Keranjang API
  function add(item: Omit<CartItem, "qty">, qty = 1) {
    if (!keyRef.current) return;
    setState((prev) => {
      const existing = prev.items.find((x) => x.id === item.id);
      const next: CartState = existing
        ? {
            items: prev.items.map((x) =>
              x.id === item.id ? { ...x, qty: x.qty + qty } : x
            ),
          }
        : { items: [...prev.items, { ...item, qty }] };
      writeNow(next);
      return next;
    });
  }

  function setQty(id: string, qty: number) {
    if (!keyRef.current) return;
    setState((prev) => {
      const next: CartState =
        qty <= 0
          ? { items: prev.items.filter((x) => x.id !== id) }
          : {
              items: prev.items.map((x) => (x.id === id ? { ...x, qty } : x)),
            };
      writeNow(next);
      return next;
    });
  }

  function remove(id: string) {
    if (!keyRef.current) return;
    setState((prev) => {
      const next = { items: prev.items.filter((x) => x.id !== id) };
      writeNow(next);
      return next;
    });
  }

  function clear() {
    if (!keyRef.current) return;
    const next = EMPTY;
    setState(next);
    writeNow(next);
  }

  /** Paksa simpan segera, digunakan sebelum berpindah halaman. */
  function saveNow() {
    if (keyRef.current) {
      saveLS(keyRef.current, state);
      const merchant = keyRef.current.replace(/^cart:/, "");
      if (state.items.length > 0) setLastMerchant(merchant);
    }
  }

  const count = useMemo(
    () => state.items.reduce((a, b) => a + b.qty, 0),
    [state.items]
  );
  const subtotal = useMemo(
    () => state.items.reduce((a, b) => a + b.price * b.qty, 0),
    [state.items]
  );

  return {
    merchantId: effectiveMerchantId,
    cart: state,
    add,
    setQty,
    remove,
    clear,
    count,
    subtotal,
    ready: Boolean(cartKey),
    saveNow,
  };
}
