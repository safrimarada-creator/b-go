"use client";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";

export type LaundryPricing = {
    perKg: number;      // harga per kg
    minKg: number;      // minimum bayar
    expressExtra?: number;  // tambahan jika express
    perfumeExtra?: number;  // tambahan jika pakai parfum
    pickupFee?: number;     // biaya pickup
};

export function usePricingLaundry() {
    const [pricing, setPricing] = useState<LaundryPricing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setErr] = useState<string | null>(null);
    const [meta, setMeta] = useState<{ updatedAt?: Date; updatedBy?: string }>();

    useEffect(() => {
        const ref = doc(db, "configs", "pricing_laundry");
        const unsub = onSnapshot(
            ref,
            (snap) => {
                if (!snap.exists()) {
                    setPricing({
                        perKg: 7000,
                        minKg: 3,
                        expressExtra: 3000,
                        perfumeExtra: 1000,
                        pickupFee: 3000,
                    });
                    setLoading(false);
                    return;
                }
                const d = snap.data() as any;
                setPricing({
                    perKg: Number(d.perKg ?? 0),
                    minKg: Number(d.minKg ?? 0),
                    expressExtra: Number(d.expressExtra ?? 0),
                    perfumeExtra: Number(d.perfumeExtra ?? 0),
                    pickupFee: Number(d.pickupFee ?? 0),
                });
                setMeta({
                    updatedBy: d.updatedBy || undefined,
                    updatedAt:
                        d.updatedAt?.toDate && typeof d.updatedAt.toDate === "function"
                            ? (d.updatedAt as Timestamp).toDate()
                            : undefined,
                });
                setLoading(false);
            },
            (e) => {
                setErr(String(e?.message || e));
                setLoading(false);
            }
        );
        return () => unsub();
    }, []);

    return { pricing, loading, error, meta };
}
