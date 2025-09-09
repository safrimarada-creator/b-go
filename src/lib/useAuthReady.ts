// src/lib/useAuthReady.ts
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type IdTokenResult } from "firebase/auth";

/**
 * Menjamin:
 * - Sudah login
 * - Token sudah di-refresh (custom claims up-to-date)
 * - Mengembalikan { ready, uid, claims }
 */
export function useAuthReady() {
    const [ready, setReady] = useState(false);
    const [uid, setUid] = useState<string | null>(null);
    const [claims, setClaims] = useState<IdTokenResult["claims"] | null>(null);

    useEffect(() => {
        let cancelled = false;
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (!u) {
                if (!cancelled) {
                    setReady(false);
                    setUid(null);
                    setClaims(null);
                }
                return;
            }
            try {
                // refresh token agar custom claims (role) terbaru
                await u.getIdToken(true);
                const t = await u.getIdTokenResult(true);
                if (!cancelled) {
                    setUid(u.uid);
                    setClaims(t.claims || null);
                    setReady(true);
                }
            } catch {
                if (!cancelled) setReady(true); // tetap lanjut, biar tidak ngegantung
            }
        });
        return () => {
            cancelled = true;
            unsub();
        };
    }, []);

    return { ready, uid, claims };
}
