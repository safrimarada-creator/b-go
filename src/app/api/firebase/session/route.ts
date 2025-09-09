// src/app/api/firebase/session/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        // pastikan kamu sudah login NextAuth di browser sebelum memanggil endpoint ini
    }

    const email = session.user.email.toLowerCase();
    const uid = `nextauth:${email}`;

    // Ambil role TERKINI dari Firestore (seed jika belum ada)
    const ref = adminDb.collection("users").doc(email);
    const snap = await ref.get();
    let role = "customer";
    if (!snap.exists) {
        await ref.set({
            email,
            name: session.user.name ?? "",
            image: (session.user as any).image ?? null,
            role,
            createdAt: FieldValue.serverTimestamp(),
        });
    } else {
        role = (snap.data()?.role as string) || "customer";
    }

    // Buat custom token dengan klaim terbaru
    const token = await adminAuth.createCustomToken(uid, {
        role,
        email,
        name: session.user.name ?? "",
    });

    return NextResponse.json({
        token,
        uid,
        claims: { role, email, name: session.user.name ?? "" },
    });
}
