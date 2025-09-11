// src/types/driver.ts
export type LatLng = { lat: number; lng: number };

export type DriverLocationDoc = {
    uid: string;
    online: boolean;
    coords: LatLng | null;
    vehicleType?: "bike" | "car2" | "car3";
    name?: string | null;
    email?: string | null;
    updatedAt?: FirebaseFirestore.Timestamp;
    expiresAt?: FirebaseFirestore.Timestamp;
};
