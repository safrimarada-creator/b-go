// src/lib/fare.ts
import type { PricingConfig } from "@/config/pricing";
import { DEFAULT_PRICING_RIDE } from "@/config/pricing";

export type FareBreakdown = {
    currency: "IDR";
    baseFare: number;
    distanceKm: number;
    durationMin: number;
    distanceFare: number;
    timeFare: number;
    bookingFee: number;
    surgeMultiplier: number;
    surgeAmount: number;
    subtotal: number;
    totalBeforeMin: number;
    total: number;
    roundedTo: number;
};

function roundToStep(n: number, step?: number) {
    if (!step || step <= 0) return Math.round(n);
    return Math.round(n / step) * step;
}

export function formatIDR(n: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(n);
}

/**
 * Hitung estimasi tarif berbasis jarak (meter) & durasi (detik).
 * `pricing` dapat diisi dari Firestore (hook usePricing), dan tetap kompatibel
 * jika masih ada field lama: perMin / roundTo.
 */
export function calculateFare(
    distanceMeters: number,
    durationSeconds: number,
    pricing?: Partial<PricingConfig> | null
): FareBreakdown {
    // Merge dengan default
    const merged: PricingConfig = {
        ...DEFAULT_PRICING_RIDE,
        ...(pricing || {}),
    } as PricingConfig;

    // Kompatibilitas dengan field lama (jika ada)
    const legacyPerMin = (pricing as any)?.perMin;
    const legacyRoundTo = (pricing as any)?.roundTo;

    const baseFare = merged.baseFare;
    const perKm = merged.perKm;
    const perMinute =
        typeof merged.perMinute === "number"
            ? merged.perMinute
            : typeof legacyPerMin === "number"
                ? legacyPerMin
                : DEFAULT_PRICING_RIDE.perMinute;

    const bookingFee = merged.bookingFee;
    const surgeMultiplier = merged.surgeMultiplier ?? 1;
    const minFare = merged.minFare ?? 0;
    const rounding =
        typeof merged.rounding === "number"
            ? merged.rounding
            : typeof legacyRoundTo === "number"
                ? legacyRoundTo
                : DEFAULT_PRICING_RIDE.rounding ?? 0;

    const distanceKm = Math.max(0, distanceMeters) / 1000;
    const durationMin = Math.max(0, durationSeconds) / 60;

    const distanceFare = perKm * distanceKm;
    const timeFare = perMinute * durationMin;

    const subtotal = baseFare + distanceFare + timeFare;
    const surged = subtotal * surgeMultiplier;
    const surgeAmount = surged - subtotal;

    const totalBeforeMin = surged + bookingFee;

    const rounded = roundToStep(totalBeforeMin, rounding);
    const total = Math.max(rounded, minFare);

    return {
        currency: "IDR",
        baseFare,
        distanceKm,
        durationMin,
        distanceFare,
        timeFare,
        bookingFee,
        surgeMultiplier,
        surgeAmount,
        subtotal,
        totalBeforeMin,
        total,
        roundedTo: rounding,
    };
}
