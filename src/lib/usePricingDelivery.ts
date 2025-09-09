"use client";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";

export type DeliveryPricing = {
    baseFare: number;
    perKm: number;
    perMin: number;
    bookingFee: number;
    minFare: number;
    roundTo: number;
    surgeMultiplier: number;
    vehicleMultipliers?: { bike?: number; car2?: number; car3?: number };
};

const DEFAULT_VM = { bike: 1, car2: 1.6, car3: 2.0 };

export function usePricingDelivery() {
    const [pricing, setPricing] = useState<DeliveryPricing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setErr] = useState<string | null>(null);
    const [meta, setMeta] = useState<{ updatedAt?: Date; updatedBy?: string }>();

    useEffect(() => {
        const ref = doc(db, "configs", "pricing_delivery");
        const unsub = onSnapshot(
            ref,
            (snap) => {
                if (!snap.exists()) {
                    setPricing({
                        baseFare: 6000,
                        perKm: 2800,
                        perMin: 300,
                        bookingFee: 1000,
                        minFare: 9000,
                        roundTo: 500,
                        surgeMultiplier: 1,
                        vehicleMultipliers: DEFAULT_VM,
                    });
                    setLoading(false);
                    return;
                }
                const d = snap.data() as any;
                setPricing({
                    baseFare: Number(d.baseFare ?? 0),
                    perKm: Number(d.perKm ?? 0),
                    perMin: Number(d.perMin ?? 0),
                    bookingFee: Number(d.bookingFee ?? 0),
                    minFare: Number(d.minFare ?? 0),
                    roundTo: Number(d.roundTo ?? 100),
                    surgeMultiplier: Number(d.surgeMultiplier ?? 1),
                    vehicleMultipliers: { ...DEFAULT_VM, ...(d.vehicleMultipliers || {}) },
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
