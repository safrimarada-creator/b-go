"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import SidebarDriver from "@/components/SidebarDriver";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import type { LatLng } from "@/lib/driverPresence";
import { useDriverPresence } from "@/lib/driverPresence";
import { formatDistance, haversine } from "@/lib/geo";
import {
  Car,
  MapPin,
  Route,
  Clock,
  CheckCircle2,
  Navigation,
  Flag,
} from "lucide-react";
import type { OrderDoc, VehicleType } from "@/types/order";
import { useDriverProfile } from "@/lib/useDriverProfile";
import { onAuthStateChanged } from "firebase/auth";

const OSMMapView = dynamic(() => import("@/components/OSMMapView"), {
  ssr: false,
});

function useAuthReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setReady(true));
    return () => unsub();
  }, []);
  return ready;
}

function isRouteOrder(o: OrderDoc | null | undefined): o is OrderDoc & {
  service: "ride" | "delivery";
  pickup?: { address?: string; coords?: LatLng | null };
  destinations?: Array<{ address?: string; coords?: LatLng | null }>;
  route?: { distanceText?: string; durationText?: string };
  vehicleType?: VehicleType;
} {
  if (!o) return false;
  const s = (o as any).service;
  return s === "ride" || s === "delivery";
}

export default function DriverOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const authReady = useAuthReady();

  const { profile: driverProfile } = useDriverProfile(); // { vehicleType, ... }
  const { myLoc } = useDriverPresence();

  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // subscribe order setelah auth siap
  useEffect(() => {
    if (!id || !authReady) return;
    const ref = doc(db, "orders", id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setErr("Order tidak ditemukan.");
          setOrder(null);
        } else {
          setOrder(snap.data() as OrderDoc);
          setErr(null);
        }
      },
      (e) => setErr(String(e?.message || e))
    );
    return () => unsub();
  }, [id, authReady]);

  // derivasi aman untuk map
  const pickupCoords: LatLng | null = isRouteOrder(order)
    ? order.pickup?.coords || null
    : null;

  const waypoints: (LatLng | null)[] = useMemo(() => {
    if (!isRouteOrder(order)) return [];
    return (order.destinations || []).map((d) => d.coords || null);
  }, [order]);

  const canDrawRoute = Boolean(pickupCoords && waypoints.some(Boolean));

  const vehicle: VehicleType =
    (isRouteOrder(order) && (order.vehicleType as VehicleType)) || "bike";

  const routeDistanceText = isRouteOrder(order)
    ? order.route?.distanceText || "-"
    : "-";
  const routeDurationText = isRouteOrder(order)
    ? order.route?.durationText || "-"
    : "-";
  const pickupAddress = isRouteOrder(order)
    ? order.pickup?.address || "-"
    : "-";

  const mapCenter: LatLng = pickupCoords ||
    order?.driver?.coords ||
    myLoc || { lat: -1.25, lng: 124.45 };

  const myUid = auth.currentUser?.uid || null;
  const iAmAssigned =
    myUid && order?.driver?.uid && order.driver.uid === myUid ? true : false;

  // Accept (transaction + cek vehicleType)
  async function acceptOrder() {
    if (!id) return;
    if (!auth.currentUser?.uid) {
      alert("Belum terhubung ke Firebase Auth di perangkat ini.");
      return;
    }
    setAccepting(true);
    try {
      const ref = doc(db, "orders", id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error("Order tidak ditemukan.");
        const data = snap.data() as OrderDoc;

        if (data.status !== "searching") {
          throw new Error("Order sudah tidak tersedia.");
        }

        const driverV: VehicleType = driverProfile?.vehicleType || "bike";
        const orderV: VehicleType =
          (isRouteOrder(data) && (data.vehicleType as VehicleType)) || "bike";

        if (isRouteOrder(data) && orderV !== driverV) {
          throw new Error(
            `Tipe kendaraan tidak cocok (order: ${orderV}, Anda: ${driverV})`
          );
        }

        const uid = auth.currentUser!.uid;
        const name =
          auth.currentUser?.displayName || driverProfile?.name || null;
        const email = auth.currentUser?.email || driverProfile?.email || null;

        tx.update(ref, {
          status: "assigned",
          assignedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          driver: {
            ...(data as any).driver,
            uid,
            name,
            email,
          },
        });
      });
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setAccepting(false);
    }
  }

  // Mirror lokasi driver → orders/{id}.driver.coords
  const lastMirrorRef = useRef(0);
  useEffect(() => {
    if (!id || !myLoc || !order) return;
    if (!iAmAssigned) return;
    const s = order.status || "";
    if (!["assigned", "driver_arriving", "ongoing"].includes(s)) return;

    const now = Date.now();
    if (now - lastMirrorRef.current < 2000) return; // throttle 2s
    lastMirrorRef.current = now;

    const ref = doc(db, "orders", id);
    updateDoc(ref, {
      driver: {
        ...(order as any).driver,
        uid: myUid,
        coords: { lat: myLoc.lat, lng: myLoc.lng },
      },
      driverUpdatedAt: serverTimestamp(),
    }).catch((e) => {
      console.warn("mirror driver coords failed:", e);
    });
  }, [id, myLoc, order, iAmAssigned, myUid]);

  // Progress status
  async function goTo(next: "driver_arriving" | "ongoing" | "completed") {
    if (!id || !order) return;
    if (!iAmAssigned) {
      alert("Anda bukan driver yang ditugaskan untuk order ini.");
      return;
    }
    setSaving(true);
    try {
      const ref = doc(db, "orders", id);
      await updateDoc(ref, {
        status: next,
        ...(next === "ongoing" ? { startedAt: serverTimestamp() } : {}),
        ...(next === "completed" ? { completedAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      alert("Gagal update status: " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  }

  function renderNextActions() {
    const s = order?.status || "";

    if (s === "searching") {
      return (
        <button
          onClick={acceptOrder}
          disabled={accepting}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-white ${
            accepting ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {accepting ? "Memproses…" : "Ambil Order"}
        </button>
      );
    }

    if (!iAmAssigned) return null;

    if (s === "assigned") {
      return (
        <button
          onClick={() => goTo("driver_arriving")}
          disabled={saving}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-white ${
            saving ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          <Navigation className="w-4 h-4" />
          Menuju Penjemputan
        </button>
      );
    }
    if (s === "driver_arriving") {
      return (
        <button
          onClick={() => goTo("ongoing")}
          disabled={saving}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-white ${
            saving ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          <Car className="w-4 h-4" />
          Mulai Perjalanan
        </button>
      );
    }
    if (s === "ongoing") {
      return (
        <button
          onClick={() => goTo("completed")}
          disabled={saving}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-white ${
            saving ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          <Flag className="w-4 h-4" />
          Selesaikan
        </button>
      );
    }
    return null;
  }

  const distToPickup = useMemo(() => {
    if (!myLoc || !isRouteOrder(order) || !order.pickup?.coords) return null;
    return haversine(myLoc, order.pickup.coords);
  }, [myLoc, order]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarDriver />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Car className="w-6 h-6 text-emerald-600" />
            <span>Order Driver</span>
          </h1>
          <div className="flex items-center gap-2">{renderNextActions()}</div>
        </div>

        {err && (
          <div className="mb-3 text-[13px] px-3 py-2 rounded border border-red-300 bg-red-50 text-red-700">
            {err}
          </div>
        )}

        {/* Peta */}
        <div className="mb-4 rounded-xl overflow-hidden border">
          <OSMMapView
            variant="streets"
            center={mapCenter}
            pickup={pickupCoords}
            waypoints={waypoints}
            drawRoute={canDrawRoute}
            driverMarker={order?.driver?.coords || myLoc || null}
            driverVehicle={vehicle}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Info label="Status" value={order?.status || "-"} />
          <Info
            label="Jarak"
            value={routeDistanceText}
            icon={<Route className="w-4 h-4" />}
          />
          <Info
            label="Estimasi Waktu"
            value={routeDurationText}
            icon={<Clock className="w-4 h-4" />}
          />
        </div>

        <div className="mt-4 bg-white rounded-xl shadow p-4 space-y-2">
          <div className="text-sm font-semibold">Penjemputan</div>
          <div className="text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{pickupAddress}</span>
          </div>
          {distToPickup != null && (
            <div className="text-xs text-gray-600">
              Jarak saya ke pickup: {formatDistance(distToPickup)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm flex items-center gap-2">
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
