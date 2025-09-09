// // src/components/FirebaseAuthBridge.tsx
// "use client";

// import { useEffect } from "react";
// import { useSession } from "next-auth/react";
// import { auth } from "@/lib/firebase";
// import {
//   onAuthStateChanged,
//   signInWithCustomToken,
//   signOut as fbSignOut,
// } from "firebase/auth";

// export default function FirebaseAuthBridge() {
//   const { status } = useSession();

//   // Log perubahan state, membantu debug
//   useEffect(() => {
//     const unsub = onAuthStateChanged(auth, (u) => {
//       // console.log("Firebase currentUser:", u?.uid);
//     });
//     return () => unsub();
//   }, []);

//   useEffect(() => {
//     let cancelled = false;

//     async function sync() {
//       // Saat belum login NextAuth → pastikan Firebase juga sign-out
//       if (status === "unauthenticated") {
//         if (auth.currentUser) await fbSignOut(auth);
//         return;
//       }
//       if (status !== "authenticated") return;

//       // Jika sudah ada user Firebase, biarkan (opsional: bisa revalidate token)
//       if (auth.currentUser) return;

//       // Mintakan custom token dari server
//       const res = await fetch("/api/firebase/session", {
//         credentials: "include",
//       });
//       if (!res.ok) {
//         console.warn("Custom token fetch failed:", res.status);
//         return;
//       }
//       const { token } = await res.json();
//       if (cancelled) return;

//       // Sign-in ke Firebase pakai custom token
//       await signInWithCustomToken(auth, token);
//     }

//     sync().catch((e) => console.warn("Bridge error:", e));
//     return () => {
//       cancelled = true;
//     };
//   }, [status]);

//   return null;
// }

// src/components/FirebaseAuthBridge.tsx
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { auth } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut as fbSignOut,
} from "firebase/auth";

export default function FirebaseAuthBridge() {
  const { status } = useSession();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("[Bridge] onAuthStateChanged uid:", u?.uid || "-");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      console.log("[Bridge] session status:", status);

      if (status === "unauthenticated") {
        if (auth.currentUser) {
          console.log("[Bridge] signing out Firebase (unauthenticated)");
          await fbSignOut(auth);
        }
        return;
      }
      if (status !== "authenticated") return;

      if (auth.currentUser) {
        console.log(
          "[Bridge] Firebase already signed-in uid:",
          auth.currentUser.uid
        );
        return;
      }

      console.log("[Bridge] fetching custom token...");
      const res = await fetch("/api/firebase/session", {
        credentials: "include",
      });
      if (!res.ok) {
        console.error("[Bridge] /api/firebase/session failed:", res.status);
        return;
      }
      const { token } = await res.json();
      if (cancelled) return;

      try {
        console.log("[Bridge] signing in with custom token...");
        await signInWithCustomToken(auth, token);
        console.log("[Bridge] signInWithCustomToken OK");
      } catch (e: any) {
        console.error(
          "[Bridge] signInWithCustomToken ERROR:",
          e?.code,
          e?.message || e
        );
      }
    }

    sync().catch((e) => console.error("[Bridge] sync error:", e));
    return () => {
      cancelled = true;
    };
  }, [status]);

  return null;
}
