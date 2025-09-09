// src/lib/authOptions.ts
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { adminDb } from "@/lib/firebaseAdmin";

export const authOptions: NextAuthOptions = {
    session: { strategy: "jwt" },
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        // Selalu sinkronkan role dari Firestore Admin
        async jwt({ token, user }) {
            const email = (token?.email as string) || user?.email;
            if (!email) return token;

            const ref = adminDb.collection("users").doc(email.toLowerCase());
            const snap = await ref.get();

            if (!snap.exists && user) {
                await ref.set({
                    email: email.toLowerCase(),
                    name: user.name ?? "",
                    image: (user as any).image ?? null,
                    role: "customer",          // default pertama kali
                    createdAt: new Date(),
                });
                (token as any).role = "customer";
            } else {
                (token as any).role = (snap.data()?.role as string) || "customer";
            }
            return token;
        },
        async session({ session, token }) {
            (session.user as any).role = (token as any).role || "customer";
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};
