// src/lib/driverPresence.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";

export type LatLng = { lat: number; lng: number };

export async function upsertDriverLocation(loc: LatLng | null, online: boolean) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("No Firebase user");

    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));

    await setDoc(
        doc(db, "driverLocations", uid),
        {
            uid,
            online,
            coords: loc ? { lat: loc.lat, lng: loc.lng } : null,
            updatedAt: serverTimestamp(),
            expiresAt,
        },
        { merge: true }
    );
}

export function useDriverPresence() {
    // ⬇️ Render awal seragam dengan SSR
    const [online, setOnline] = useState<boolean>(false);

    // Restore preferensi setelah mount → aman untuk hydration
    useEffect(() => {
        try {
            const persisted = localStorage.getItem("driverOnline") === "1";
            if (persisted) setOnline(true);
        } catch { }
    }, []);

    // Simpan preferensi setiap berubah
    useEffect(() => {
        try {
            localStorage.setItem("driverOnline", online ? "1" : "0");
        } catch { }
    }, [online]);

    const [myLoc, setMyLoc] = useState<LatLng | null>(null);
    const [error, setError] = useState<string | null>(null);

    const watchIdRef = useRef<number | null>(null);
    const lastSentAtRef = useRef<number>(0);
    const lastSentLocRef = useRef<LatLng | null>(null);
    const prevOnlineRef = useRef<boolean>(false);

    useEffect(() => {
        // Hanya bertindak jika toggle berubah, tidak saat mount pertama
        if (prevOnlineRef.current === online) {
            prevOnlineRef.current = online;
            return;
        }
        prevOnlineRef.current = online;

        if (!online) {
            // Matikan → kirim offline sekali
            if (watchIdRef.current != null && typeof navigator !== "undefined") {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            (async () => {
                try {
                    await upsertDriverLocation(null, false);
                } catch { }
            })();
            return;
        }

        // Online → watchPosition
        if (typeof window === "undefined" || !navigator?.geolocation) {
            setError("Geolocation tidak tersedia.");
            return;
        }
        setError(null);

        const id = navigator.geolocation.watchPosition(
            async (pos) => {
                const coord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setMyLoc(coord);

                const now = Date.now();
                const moved =
                    !lastSentLocRef.current ||
                    lastSentLocRef.current.lat !== coord.lat ||
                    lastSentLocRef.current.lng !== coord.lng;

                if (moved && now - lastSentAtRef.current >= 3000) {
                    lastSentAtRef.current = now;
                    lastSentLocRef.current = coord;
                    try {
                        await upsertDriverLocation(coord, true);
                    } catch (e: any) {
                        setError(e?.message ?? String(e));
                    }
                }
            },
            (err) => setError(err?.message || "Gagal membaca lokasi."),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
        watchIdRef.current = id;

        return () => {
            if (watchIdRef.current != null && typeof navigator !== "undefined") {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [online]);

    return { online, setOnline, myLoc, error };
}
