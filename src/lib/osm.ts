// src/lib/osm.ts
export type LatLng = { lat: number; lng: number };

const NOMINATIM = "https://nominatim.openstreetmap.org";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || ""; // sopan santun

export async function osmSearch(query: string, country = "id", limit = 5) {
    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("countrycodes", country);
    url.searchParams.set("q", query);
    url.searchParams.set("accept-language", "id");
    if (CONTACT_EMAIL) url.searchParams.set("email", CONTACT_EMAIL);

    const res = await fetch(url.toString(), { headers: { "Accept-Language": "id" } });
    if (!res.ok) throw new Error("Nominatim search failed");
    const data = (await res.json()) as any[];
    return data.map((d) => ({
        label: d.display_name as string,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
    }));
}

export async function osmReverseGeocode({ lat, lng }: LatLng) {
    const url = new URL(`${NOMINATIM}/reverse`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "id");
    if (CONTACT_EMAIL) url.searchParams.set("email", CONTACT_EMAIL);

    const res = await fetch(url.toString(), { headers: { "Accept-Language": "id" } });
    if (!res.ok) throw new Error("Nominatim reverse failed");
    const data = await res.json();
    return (data?.display_name as string) || `(${lat.toFixed(5)}, ${lng.toFixed(5)})`;
}

const ORS_KEY = process.env.NEXT_PUBLIC_ORS_API_KEY || "";

/** Routing 2 titik (kompat) */
export async function routeDriving(start: LatLng, end: LatLng) {
    return routeDrivingMulti(start, [end]);
}

/** Routing multi-waypoint: start + [wp1, wp2, ...] */
export async function routeDrivingMulti(start: LatLng, waypoints: LatLng[]) {
    if (!waypoints || waypoints.length === 0) {
        return { distance: 0, duration: 0, path: [] as LatLng[] };
    }

    // ====== PROD: OpenRouteService (directions) – mendukung multi-coords via POST
    if (ORS_KEY) {
        const coords = [start, ...waypoints].map((p) => [p.lng, p.lat]);
        const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
            method: "POST",
            headers: {
                "Authorization": ORS_KEY,         // ORS menerima key di header Authorization
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ coordinates: coords, instructions: false }),
        });
        if (!res.ok) throw new Error("OpenRouteService routing failed");
        const json = await res.json();
        const feat = json?.features?.[0];
        const c = (feat?.geometry?.coordinates || []) as [number, number][];
        const distance = feat?.properties?.summary?.distance || 0; // meters
        const duration = feat?.properties?.summary?.duration || 0; // seconds
        const path = c.map(([lon, lat]) => ({ lat, lng: lon }));
        return { distance, duration, path };
    }

    // ====== DEV: OSRM demo – multi point di URL (jangan untuk beban berat)
    const all = [start, ...waypoints]
        .map((p) => `${p.lng},${p.lat}`)
        .join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${all}?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("OSRM routing failed");
    const json = await res.json();
    const route = json?.routes?.[0];
    const dist = route?.distance || 0;
    const dur = route?.duration || 0;
    const coords = (route?.geometry?.coordinates || []) as [number, number][];
    const path = coords.map(([lon, lat]) => ({ lat, lng: lon }));
    return { distance: dist, duration: dur, path };
}
