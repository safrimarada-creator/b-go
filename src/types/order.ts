// Discriminated unions untuk semua layanan

export type VehicleType = "bike" | "car2" | "car3";

export type LatLng = { lat: number; lng: number };

// Status generik
export type OrderStatus =
    | "searching"
    | "assigned"
    | "driver_arriving"
    | "ongoing"
    | "completed"
    | "canceled";

// ---- RIDE / DELIVERY sama-sama perlu rute ----
export type RouteInfo = {
    distanceText?: string;
    durationText?: string;
    distanceValue?: number; // meter
    durationValue?: number; // detik
};

// Base dokumen yg pasti ada
export type OrderBase = {
    id?: string;
    service: "ride" | "delivery" | "laundry" | "merchant";
    status: OrderStatus;
    createdAt?: any;
    updatedAt?: any;
    assignedAt?: any;
    startedAt?: any;
    completedAt?: any;

    customer: { uid: string; name?: string | null; email?: string | null };

    driver?: {
        uid?: string;
        name?: string | null;
        email?: string | null;
        coords?: LatLng | null;
    } | null;
    driverUpdatedAt?: any;
};

// ---- RIDE ----
export type RideOrder = OrderBase & {
    service: "ride";
    vehicleType: VehicleType;
    pickup: { address: string; coords: LatLng };
    destinations: Array<{ address: string; coords: LatLng }>;
    route: RouteInfo;
    fare?: {
        currency: "IDR";
        total: number;
        baseFare: number;
        distanceFare: number;
        timeFare: number;
        bookingFee: number;
        surgeMultiplier: number;
    };
    pricingSnapshot?: any;
};

// ---- DELIVERY (antar barang) ----
export type DeliveryOrder = OrderBase & {
    service: "delivery";
    vehicleType: VehicleType;
    pickup: { address: string; coords: LatLng; contactName?: string; phone?: string };
    dropoff: { address: string; coords: LatLng; contactName?: string; phone?: string };
    note?: string;
    route: RouteInfo;
    fare?: {
        currency: "IDR";
        total: number;
        baseFare: number;
        distanceFare: number;
        timeFare: number;
        bookingFee: number;
        surgeMultiplier: number;
    };
    pricingSnapshot?: any;
};

// ---- LAUNDRY ----
export type LaundryOrder = OrderBase & {
    service: "laundry";
    pickupAddress: string;
    pickupCoords?: LatLng | null;
    dropAddress?: string;
    schedule?: { dateISO: string; time?: string }; // sederhana
    kg: number; // berat
    options?: { express?: boolean; perfume?: boolean };
    fare?: {
        currency: "IDR";
        subtotal: number; // perKg * kg (+ express, parfum)
        pickupFee: number;
        total: number;
    };
    pricingSnapshot?: any;
};

// ---- MERCHANT (checkout) — ringkas untuk MVP ----
export type MerchantOrder = OrderBase & {
    service: "merchant";
    merchantId: string;
    items: Array<{ productId: string; name: string; qty: number; price: number }>;
    subtotal: number;
    delivery?: {
        vehicleType: VehicleType;
        to: { address: string; coords: LatLng };
        route?: RouteInfo;
        deliveryFee: number;
    };
    platformFee?: number;
    total: number;
    pricingSnapshot?: any;
};

export type OrderDoc = RideOrder | DeliveryOrder | LaundryOrder | MerchantOrder;
