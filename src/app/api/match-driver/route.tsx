import { NextRequest, NextResponse } from "next/server";
import { adminDb, AdminTimestamp } from "@/lib/firebase-server";
import type { DriverLocationDoc } from "@/types/driver";

export const runtime = "nodejs";

// Calculate meters using Haversine
function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

export async function POST(req: NextRequest) {
  try {
    const { orderId } = (await req.json()) as { orderId: string };
    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    // Get order & pickup coords
    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const orderData = orderSnap.data() as any;
    const pickup = orderData?.pickup?.coords;
    if (!pickup) {
      return NextResponse.json(
        { error: "Order missing pickup coords" },
        { status: 400 }
      );
    }

    // Read online drivers
    const driversSnap = await adminDb
      .collection("driverLocations")
      .where("online", "==", true)
      .limit(200)
      .get();

    const candidates: (DriverLocationDoc & { distance: number })[] =
      driversSnap.docs
        .map((d) => {
          const data = d.data() as DriverLocationDoc;
          return { ...data, id: d.id };
        })
        .filter((d) => d.coords)
        .map((d) => ({
          ...d,
          distance: haversine(pickup, d.coords!),
        }))
        .sort((a, b) => a.distance - b.distance);

    if (candidates.length === 0) {
      return NextResponse.json({ error: "No drivers online" }, { status: 404 });
    }

    const chosen = candidates[0];

    // Optionally fetch details from /drivers/{uid}
    const driverDoc = await adminDb.collection("drivers").doc(chosen.uid).get();
    const driverInfo: any = driverDoc.exists ? driverDoc.data() : {};

    await orderRef.update({
      status: "assigned",
      assignedAt: AdminTimestamp.now(),
      updatedAt: AdminTimestamp.now(),
      driver: {
        uid: chosen.uid,
        name: chosen.name ?? driverInfo?.name ?? null,
        email: chosen.email ?? driverInfo?.email ?? null,
        coords: chosen.coords,
        vehicleType: chosen.vehicleType ?? driverInfo?.vehicleType ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      chosen: {
        uid: chosen.uid,
        distanceMeters: Math.round(chosen.distance),
        vehicleType: chosen.vehicleType ?? driverInfo?.vehicleType ?? null,
        name: chosen.name ?? driverInfo?.name ?? null,
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message || String(e) },
      { status: 500 }
    );
  }
}
