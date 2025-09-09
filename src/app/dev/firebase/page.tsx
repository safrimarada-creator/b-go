// src/app/dev/firebase/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import type { IdTokenResult } from "firebase/auth";

export default function DevFirebasePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [claims, setClaims] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  async function refresh() {
    setLoading(true);
    try {
      // paksa refresh token & klaim
      await auth.currentUser?.getIdToken(true);
      const res: IdTokenResult | undefined =
        await auth.currentUser?.getIdTokenResult(true);
      setUid(auth.currentUser?.uid ?? null);
      setClaims(res?.claims ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function rebridge() {
    // ambil custom token dari server (NextAuth → Firebase custom token)
    const r = await fetch("/api/firebase/session", { credentials: "include" });
    if (!r.ok) {
      alert("Gagal ambil custom token dari /api/firebase/session");
      return;
    }
    const { token } = await r.json();

    const { signInWithCustomToken } = await import("firebase/auth");
    await signInWithCustomToken(auth, token);
    await refresh();
  }

  useEffect(() => {
    // Ekspos ke window agar bisa dipakai di DevTools
    (window as any).auth = auth;
    (window as any).getClaims = async () =>
      (await auth.currentUser?.getIdTokenResult(true))?.claims;

    // auto refresh pada load
    refresh();
  }, []);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Firebase Debug</h1>

      <div className="rounded-lg border bg-white p-4">
        <div className="text-sm font-semibold mb-2">Public Config</div>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(cfg, null, 2)}
        </pre>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={refresh}
            className="px-3 py-2 rounded-md border text-sm"
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh Claims"}
          </button>
          <button
            onClick={rebridge}
            className="px-3 py-2 rounded-md border text-sm"
            disabled={loading}
            title="Sign-in ulang Firebase dengan custom token dari server"
          >
            Re-bridge (custom token)
          </button>
        </div>

        <div className="text-sm">
          <div>
            <b>Auth currentUser UID:</b> {uid ?? "-"}
          </div>
          <div className="mt-2">
            <b>Claims:</b>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(claims ?? null, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </main>
  );
}
