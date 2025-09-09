// src/config/pricing.ts
export interface PricingConfig {
    currency?: "IDR";
    baseFare: number;
    perKm: number;
    perMinute: number;
    bookingFee: number;
    surgeMultiplier?: number;
    minFare?: number;
    rounding?: number;
}

export const DEFAULT_PRICING_RIDE: PricingConfig = {
    currency: "IDR",
    baseFare: 3000,     // boleh biarkan default; Firestore akan override ke 5000
    perKm: 2500,
    perMinute: 300,
    bookingFee: 1000,
    surgeMultiplier: 1,
    minFare: 8000,
    rounding: 500,
};
