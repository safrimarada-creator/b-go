"use client";

import { useEffect, useState } from "react";

export type CartItem = { id: string; name: string; price: number; qty: number };
export type Cart = { merchantId: string; items: CartItem[] };

export function useCart(merchantId: string | undefined) {
    const [cart, setCart] = useState<Cart>({ merchantId: merchantId || "", items: [] });

    useEffect(() => {
        if (!merchantId) return;
        const key = `cart:${merchantId}`;
        const raw = localStorage.getItem(key);
        if (raw) setCart(JSON.parse(raw));
        else setCart({ merchantId, items: [] });
    }, [merchantId]);

    useEffect(() => {
        if (!merchantId) return;
        localStorage.setItem(`cart:${merchantId}`, JSON.stringify(cart));
    }, [merchantId, cart]);

    function add(item: Omit<CartItem, "qty">, qty = 1) {
        setCart((c) => {
            const idx = c.items.findIndex((x) => x.id === item.id);
            if (idx >= 0) {
                const next = [...c.items];
                next[idx] = { ...next[idx], qty: next[idx].qty + qty };
                return { ...c, items: next };
            }
            return { ...c, items: [...c.items, { ...item, qty }] };
        });
    }
    function remove(id: string) { setCart((c) => ({ ...c, items: c.items.filter((x) => x.id !== id) })); }
    function setQty(id: string, qty: number) {
        setCart((c) => ({ ...c, items: c.items.map((x) => x.id === id ? { ...x, qty } : x) }));
    }
    function clear() { setCart((c) => ({ ...c, items: [] })); }
    const subtotal = cart.items.reduce((s, x) => s + x.price * x.qty, 0);

    return { cart, add, remove, setQty, clear, subtotal };
}
