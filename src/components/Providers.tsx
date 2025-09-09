// src/components/Providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import FirebaseAuthBridge from "@/components/FirebaseAuthBridge";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <FirebaseAuthBridge />
      {children}
    </SessionProvider>
  );
}
