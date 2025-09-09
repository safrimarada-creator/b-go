// src/lib/driver.ts
import { db } from "@/lib/firebase";
import {
    doc,
    runTransaction,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export async function driverAccept(
    orderId: string,
    opts?: { email?: string | null; name?: string | null }
) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("Harus login Firebase.");

    const ref = doc(db, "orders", orderId);

    await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error("Order tidak ditemukan.");
        const order = snap.data() as any;

        if (order.status !== "searching") {
            throw new Error("Order sudah tidak tersedia.");
        }
        if (order.driver) {
            throw new Error("Order sudah diambil driver lain.");
        }

        tx.update(ref, {
            status: "assigned",
            driver: {
                uid: user.uid,
                name: (opts?.name ?? user.displayName) || null,
                email: (opts?.email ?? user.email) || null,
                coords: null,
            },
            assignedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });
}

export type DriverProgressStatus =
    | "driver_arriving"
    | "ongoing"
    | "completed";

export async function driverUpdateStatus(
    orderId: string,
    next: DriverProgressStatus
) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("Harus login Firebase.");

    await updateDoc(doc(db, "orders", orderId), {
        status: next,
        updatedAt: serverTimestamp(),
    });
}

/** Mulai share lokasi realtime; kembalikan fungsi stop() */
export function startDriverLocationShare(orderId: string) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("Harus login Firebase.");

    const ref = doc(db, "orders", orderId);

    let watchId: number | null = null;
    let lastSent = 0;

    const onPos = async (pos: GeolocationPosition) => {
        const now = Date.now();
        if (now - lastSent < 3000) return; // throttle 3s
        lastSent = now;

        const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
        };

        await updateDoc(ref, {
            driver: {
                uid: user.uid,
                name: user.displayName || null,
                email: user.email || null,
                coords,
            },
            driverUpdatedAt: serverTimestamp(),
        });
    };

    const onErr = (_e: GeolocationPositionError) => {
        // bisa tampilkan toast di UI kalau mau
    };

    if (!navigator.geolocation) {
        throw new Error("Peramban tidak mendukung geolokasi.");
    }

    watchId = navigator.geolocation.watchPosition(onPos, onErr, {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
    });

    return () => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
}
