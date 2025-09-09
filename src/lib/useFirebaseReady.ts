// src/lib/useFirebaseReady.ts
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithCustomToken, onAuthStateChanged } from "firebase/auth";

export function useFirebaseReady(requiredRole?: string) {
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let unsub = onAuthStateChanged(auth, async () => {
            try {
                // kalau belum login ke Firebase → ambil custom token dari server
                if (!auth.currentUser) {
                    const r = await fetch("/api/firebase/session", { credentials: "include" });
                    if (!r.ok) throw new Error("No session");
                    const { token } = await r.json();            // ← baca 'token'
                    await signInWithCustomToken(auth, token);
                }
                // refresh claims
                const res = await auth.currentUser!.getIdTokenResult(true);
                const role = (res.claims as any)?.role;

                if (requiredRole && role !== requiredRole) {
                    throw new Error(`Butuh role ${requiredRole}, dapat ${role || "(none)"}`);
                }
                setReady(true);
            } catch (e: any) {
                setError(e?.message || String(e));
            }
        });
        return () => unsub && unsub();
    }, [requiredRole]);

    return { ready, error };
}
