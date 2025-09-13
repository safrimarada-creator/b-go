// src/app/api/match-driver/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type LatLng = { lat: number; lng: number };

function distMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function POST(req: Request) {
  try {
    // ---- Auth (ID token dari klien) ----
    const authz =
      req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "Missing Authorization Bearer <ID_TOKEN>." },
        { status: 401 }
      );
    }
    const idToken = authz.slice(7);
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);

    // ---- Body ----
    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body?.orderId;
    const maxKm: number = typeof body?.maxKm === "number" ? body.maxKm : 15;
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "orderId wajib" },
        { status: 400 }
      );
    }

    // ---- Ambil order ----
    const oref = adminDb.collection("orders").doc(orderId);
    const osnap = await oref.get();
    if (!osnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Order tidak ditemukan" },
        { status: 404 }
      );
    }
    const order: any = osnap.data() || {};

    // Opsional: hanya pemilik order yang boleh memanggil
    if (decoded && order?.customer?.uid && decoded.uid !== order.customer.uid) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // Titik pickup (wajib)
    const pickup: LatLng | null =
      order?.pickup?.coords || order?.merchant?.coords || null;

    if (!pickup) {
      await oref
        .update({
          candidateUids: [],
          candidates: [],
          candidatesUpdatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        .catch(() => {});
      return NextResponse.json({
        ok: true,
        candidates: [],
        maxKm,
        debug: { reason: "no_pickup_coords" },
      });
    }

    // ---- Ambil driver online terbaru ----
    // Catatan: kita TIDAK pakai where("isOnline", true) karena sebagian dokumen pakai "online".
    // Kita ambil terbaru by updatedAt lalu filter in-memory.
    const dsnap = await adminDb
      .collection("driverLocations")
      .orderBy("updatedAt", "desc")
      .limit(500)
      .get();

    const now = Date.now();
    const vehicleRequired: string | undefined =
      order?.vehicleType && order.vehicleType !== "any"
        ? String(order.vehicleType)
        : undefined;

    const all = dsnap.docs
      .map((d) => {
        const v = d.data() as any;
        const coords = v?.coords;
        const online = v?.isOnline === true || v?.online === true; // <- kompatibel dua nama field
        const notExpired =
          !v?.expiresAt ||
          (typeof v.expiresAt?.toDate === "function" &&
            v.expiresAt.toDate().getTime() > now);

        if (!online || !notExpired) return null;
        if (
          !coords ||
          typeof coords.lat !== "number" ||
          typeof coords.lng !== "number"
        )
          return null;

        const vt = (v?.vehicleType as string) || "bike";
        if (vehicleRequired && vt !== vehicleRequired) return null;

        return {
          uid: d.id,
          name: v?.name ?? null,
          vehicleType: vt,
          distance: distMeters(pickup, coords as LatLng),
        };
      })
      .filter(Boolean) as Array<{
      uid: string;
      name?: string | null;
      vehicleType: string;
      distance: number;
    }>;

    const within = all.filter((x) => x.distance <= maxKm * 1000);
    const ranked = (within.length ? within : all)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 30);

    // ---- Tulis kandidat ke order ----
    await oref.update({
      candidateUids: ranked.map((x) => x.uid),
      candidates: ranked,
      candidatesUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      candidates: ranked,
      maxKm,
      debug: {
        totalFetched: dsnap.size,
        totalEligible: all.length,
        withinKm: within.length,
        pickup,
        vehicleRequired: vehicleRequired ?? "any",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
