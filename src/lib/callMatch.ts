// src/lib/callMatch.ts
import { auth } from "@/lib/firebase";

type Candidate = { uid: string; name?: string | null; vehicleType?: string; distance: number };

export async function callMatch(orderId: string, maxKm = 15) {
    const user = auth.currentUser;
    if (!user) throw new Error("Belum login Firebase (currentUser null).");

    // Ambil ID token → dipakai server untuk akses Firestore REST atas nama user
    const idToken = await user.getIdToken(true);

    const res = await fetch("/api/match-driver", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`, // ← WAJIB
        },
        body: JSON.stringify({ orderId, maxKm }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
    }

    return json as { ok: true; candidates: Candidate[]; maxKm: number };
}
