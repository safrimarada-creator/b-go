import type { Timestamp } from "firebase/firestore";

export type LatLng = { lat: number; lng: number };

export type Merchant = {
    id?: string;
    name: string;
    category?: string | null;
    address?: string | null;
    photoUrl?: string | null;
    phone?: string | null;
    isActive?: boolean;

    coords?: LatLng | null;
    serviceRadiusKm?: number | null;

    createdAt?: Timestamp;
    updatedAt?: Timestamp;
};
