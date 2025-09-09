// src/lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: { params: { prompt: "select_account" } },
        }),
    ],
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    callbacks: {
        /** 
         * Inject role dari Firestore (Admin) ke token.
         * - Pertama kali login: buat dokumen user dgn role "customer"
         * - Selanjutnya: baca role dari Firestore
         */
        async jwt({ token, user }) {
            const email = (user?.email ?? token.email) as string | undefined;
            if (!email) return token;

            const ref = adminDb.collection("users").doc(email);
            const snap = await ref.get();

            if (!snap.exists) {
                await ref.set({
                    name: user?.name ?? token.name ?? "",
                    email,
                    image: (user as any)?.image ?? (token as any)?.picture ?? null,
                    role: "customer",
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    provider: "google",
                });
                (token as any).role = "customer";
            } else {
                const data = snap.data()!;
                (token as any).role = data.role ?? "customer";
            }

            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = (token as any).role ?? "customer";
                (session.user as any).id = token.sub as string | undefined;
            }
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};
