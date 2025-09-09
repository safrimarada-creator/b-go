"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import SidebarCustomer from "@/components/SidebarCustomer";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import type { LatLng } from "@/lib/driverPresence";
import {
  Car,
  MapPin,
  Route,
  Clock,
  CheckCircle2,
  Circle,
  Navigation,
  Flag,
  User2,
} from "lucide-react";
import type { OrderDoc, VehicleType } from "@/types/order";
import { onAuthStateChanged } from "firebase/auth";

const OSMMapView = dynamic(() => import("@/components/OSMMapView"), {
  ssr: false,
});

/** Tunggu Firebase Auth siap, supaya rules tidak menolak ketika subscribe terlalu cepat */
function useAuthReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setReady(true));
    return () => unsub();
  }, []);
  return ready;
}

/** Type guard: order yang berbasis rute (ride / delivery) */
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

export default function CustomerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const authReady = useAuthReady();

  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  // Derivasi aman untuk map & ringkasan
  const pickupCoords: LatLng | null = isRouteOrder(order)
    ? order.pickup?.coords || null
    : null;

  const waypoints = useMemo<(LatLng | null)[]>(() => {
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
    order?.driver?.coords || { lat: -1.25, lng: 124.45 };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Car className="w-6 h-6 text-emerald-600" />
            <span>Tracking Order</span>
          </h1>
          <StatusBadge status={order?.status} />
        </div>

        {err && (
          <div className="mb-3 text-[13px] px-3 py-2 rounded border border-red-300 bg-red-50 text-red-700">
            {err}
          </div>
        )}

        {/* Peta */}
        <div className="mb-4 rounded-xl overflow-hidden border relative z-0">
          <OSMMapView
            variant="streets"
            center={mapCenter}
            pickup={pickupCoords}
            waypoints={waypoints}
            drawRoute={canDrawRoute}
            driverMarker={order?.driver?.coords || null}
            driverVehicle={vehicle}
          />
        </div>

        {/* Ringkasan rute */}
        <div className="grid sm:grid-cols-3 gap-4">
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
          <Info
            label="Penjemputan"
            value={pickupAddress}
            icon={<MapPin className="w-4 h-4" />}
          />
        </div>

        {/* Info driver */}
        <div className="mt-4 bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold mb-2">Driver</h2>
          {order?.driver?.uid ? (
            <div className="flex items-center gap-3 text-sm">
              <User2 className="w-4 h-4 text-gray-600" />
              <div>
                <div className="font-medium">
                  {order?.driver?.name || order?.driver?.uid}
                </div>
                <div className="text-xs text-gray-600">
                  {order?.driver?.email || "-"}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Lokasi driver diperbarui:{" "}
                  {timeAgo(order?.driverUpdatedAt) || "—"}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              Driver belum ditugaskan.
            </div>
          )}
        </div>

        {/* Timeline status */}
        <div className="mt-4 bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold mb-3">Progres</h2>
          <StatusTimeline order={order} />
        </div>
      </main>
    </div>
  );
}

/* ===================== Komponen kecil ===================== */

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

function StatusBadge({ status }: { status?: OrderDoc["status"] }) {
  const map: Record<string, { text: string; cls: string }> = {
    searching: {
      text: "Mencari Driver",
      cls: "bg-amber-100 text-amber-800 border border-amber-200",
    },
    assigned: {
      text: "Driver Ditugaskan",
      cls: "bg-blue-100 text-blue-800 border border-blue-200",
    },
    driver_arriving: {
      text: "Menuju Penjemputan",
      cls: "bg-purple-100 text-purple-800 border border-purple-200",
    },
    ongoing: {
      text: "Perjalanan",
      cls: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    },
    completed: {
      text: "Selesai",
      cls: "bg-gray-100 text-gray-800 border border-gray-200",
    },
  };

  const m = status ? map[status] : undefined;
  return (
    <div
      className={`px-3 py-1.5 rounded-full text-xs font-medium ${
        m ? m.cls : "bg-gray-100 text-gray-700 border"
      }`}
    >
      {m ? m.text : "Status: -"}
    </div>
  );
}

function StatusTimeline({ order }: { order: OrderDoc | null }) {
  const s = order?.status || "searching";

  const steps: Array<{
    key: OrderDoc["status"] | "searching";
    label: string;
    icon: React.ReactNode;
    at?: Timestamp;
  }> = [
    {
      key: "searching",
      label: "Mencari Driver",
      icon: <Clock className="w-4 h-4" />,
      at: order?.createdAt,
    },
    {
      key: "assigned",
      label: "Driver Ditugaskan",
      icon: <CheckCircle2 className="w-4 h-4" />,
      at: order?.assignedAt,
    },
    {
      key: "driver_arriving",
      label: "Menuju Penjemputan",
      icon: <Navigation className="w-4 h-4" />,
      at: order?.driverUpdatedAt,
    },
    {
      key: "ongoing",
      label: "Perjalanan Dimulai",
      icon: <Car className="w-4 h-4" />,
      at: order?.startedAt || order?.updatedAt,
    },
    {
      key: "completed",
      label: "Selesai",
      icon: <Flag className="w-4 h-4" />,
      at: order?.completedAt,
    },
  ];

  const orderIndex = stepIndex(s);

  return (
    <ol className="relative border-s border-gray-200 pl-4 space-y-4">
      {steps.map((st, i) => {
        const done = i < orderIndex;
        const active = i === orderIndex;
        return (
          <li key={st.key} className="ms-2">
            <div className="flex items-start gap-3">
              <span
                className={[
                  "mt-0.5 inline-flex items-center justify-center rounded-full border w-6 h-6",
                  done
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : active
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 text-gray-400",
                ].join(" ")}
                aria-hidden
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  <span className={active ? "text-blue-700" : ""}>
                    {st.label}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {timeAgo(st.at) || "-"}
                </div>
              </div>
              <div className="text-xs text-gray-500 hidden sm:block">
                <span className="inline-flex items-center gap-1">
                  {st.icon}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ===================== Util kecil ===================== */

function stepIndex(status: string) {
  switch (status) {
    case "searching":
      return 0;
    case "assigned":
      return 1;
    case "driver_arriving":
      return 2;
    case "ongoing":
      return 3;
    case "completed":
      return 4;
    default:
      return 0;
  }
}

function timeAgo(ts?: Timestamp) {
  if (!ts?.toDate) return "";
  const d = ts.toDate() as Date;
  const diff = Math.max(0, Date.now() - d.getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const days = Math.floor(h / 24);
  return `${days} hari lalu`;
}
