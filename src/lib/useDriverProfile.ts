"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export type VehicleType = "bike" | "car2" | "car3";

export type DriverProfile = {
    uid: string;
    name?: string | null;
    email?: string | null;
    vehicleType?: VehicleType; // preferensi driver
    updatedAt?: any;
};

export function useDriverProfile() {
    const [profile, setProfile] = useState<DriverProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) {
                setLoading(false);
                return;
            }
            const ref = doc(db, "drivers", uid);
            const snap = await getDoc(ref);

            if (!snap.exists()) {
                // seed profil minimal pertama kali
                const data: DriverProfile = {
                    uid,
                    name: auth.currentUser?.displayName || null,
                    email: auth.currentUser?.email || null,
                    vehicleType: "bike",
                    updatedAt: serverTimestamp(),
                };
                await setDoc(ref, data, { merge: true });
                if (alive) setProfile(data);
            } else {
                if (alive) setProfile({ uid, ...(snap.data() as any) });
            }
            if (alive) setLoading(false);
        })();
        return () => {
            alive = false;
        };
    }, []);

    return { profile, setProfile, loading };
}
