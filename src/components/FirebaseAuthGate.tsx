// // src/components/FirebaseAuthGate.tsx
// "use client";
// import { useEffect } from "react";
// import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
// import { app } from "@/lib/firebase";

// export default function FirebaseAuthGate() {
//   useEffect(() => {
//     const auth = getAuth(app);
//     const unsub = onAuthStateChanged(auth, (user) => {
//       if (!user) {
//         // login anonim otomatis
//         signInAnonymously(auth).catch(() => {});
//       }
//     });
//     return () => unsub();
//   }, []);
//   return null;
// }
