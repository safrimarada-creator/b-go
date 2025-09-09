// src/lib/geo.ts
export type LatLng = { lat: number; lng: number };

const R = 6371000; // meters

export function toRad(deg: number) {
    return (deg * Math.PI) / 180;
}

export function haversine(a: LatLng, b: LatLng) {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sin1 = Math.sin(dLat / 2);
    const sin2 = Math.sin(dLng / 2);

    const x =
        sin1 * sin1 +
        Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;

    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c; // meters
}

export function formatDistance(meters: number) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

/** throttle + jarak minimum agar tidak spam write */
export function shouldSend(prevAt: number, prevLoc: LatLng | null, next: LatLng, minMs = 8000, minMoveM = 30) {
    const now = Date.now();
    if (!prevLoc) return true;
    if (now - prevAt > minMs) return true;
    const d = haversine(prevLoc, next);
    return d >= minMoveM;
}
