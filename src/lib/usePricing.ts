"use client";

import { db } from "@/lib/firebase";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";

export type VehicleMultipliers = {
    bike: number;
    car2: number;
    car3: number;
};

export type PricingConfig = {
    baseFare: number;
    perKm: number;
    perMin: number;
    bookingFee: number;
    minFare: number;
    roundTo: number;
    surgeMultiplier: number;
    vehicleMultipliers?: Partial<VehicleMultipliers>;
};

const DEFAULT_MULTIPLIERS: VehicleMultipliers = { bike: 1, car2: 1.6, car3: 2.0 };

export function usePricing() {
    const [pricing, setPricing] = useState<PricingConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setErr] = useState<string | null>(null);
    const [meta, setMeta] = useState<{ updatedAt?: Date; updatedBy?: string }>();

    useEffect(() => {
        const ref = doc(db, "configs", "pricing");
        const unsub = onSnapshot(
            ref,
            (snap) => {
                if (!snap.exists()) {
                    // fallback default (tidak menulis ke DB, hanya state)
                    setPricing({
                        baseFare: 5000,
                        perKm: 2500,
                        perMin: 300,
                        bookingFee: 1000,
                        minFare: 8000,
                        roundTo: 500,
                        surgeMultiplier: 1,
                        vehicleMultipliers: DEFAULT_MULTIPLIERS,
                    });
                    setMeta(undefined);
                    setLoading(false);
                    return;
                }
                const d = snap.data() as any;

                // gabungkan default + data Firestore
                const vm: VehicleMultipliers = {
                    ...DEFAULT_MULTIPLIERS,
                    ...(d.vehicleMultipliers || {}),
                };

                setPricing({
                    baseFare: Number(d.baseFare ?? 0),
                    perKm: Number(d.perKm ?? 0),
                    perMin: Number(d.perMin ?? 0),
                    bookingFee: Number(d.bookingFee ?? 0),
                    minFare: Number(d.minFare ?? 0),
                    roundTo: Number(d.roundTo ?? 100),
                    surgeMultiplier: Number(d.surgeMultiplier ?? 1),
                    vehicleMultipliers: vm,
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
