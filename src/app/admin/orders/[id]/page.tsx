"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SidebarAdmin from "@/components/SidebarAdmin";
import dynamic from "next/dynamic";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import type { LatLng } from "@/lib/osm";
import { formatIDR } from "@/lib/fare";
import {
  ArrowLeft,
  Map,
  Clock,
  Route,
  User,
  Car,
  CircleDollarSign,
} from "lucide-react";

// Peta OSM di-load client-only
const OSMMapView = dynamic(() => import("@/components/OSMMapView"), {
  ssr: false,
});

type OrderDoc = {
  service: "ride" | "delivery" | "laundry" | "products" | string;
  status:
    | "searching"
    | "assigned"
    | "driver_arriving"
    | "ongoing"
    | "completed"
    | "cancelled"
    | string;

  createdAt?: Timestamp;
  assignedAt?: Timestamp;
  updatedAt?: Timestamp;

  fare?: {
    currency?: "IDR" | string;
    total?: number;
    baseFare?: number;
    distanceFare?: number;
    timeFare?: number;
    bookingFee?: number;
    surgeMultiplier?: number;
  };

  route?: {
    distanceText?: string;
    durationText?: string;
    distanceValue?: number;
    durationValue?: number;
  };

  pickup?: { address?: string; coords?: LatLng | null };
  destinations?: Array<{ address?: string; coords?: LatLng | null }>;

  customer?: { uid?: string; name?: string; email?: string };
  driver?: {
    uid?: string;
    name?: string;
    email?: string;
    coords?: LatLng | null; // posisi driver terkini (opsional)
  };
};

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setErr(null);

    const ref = doc(db, "orders", orderId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setErr("Order tidak ditemukan.");
          setOrder(null);
        } else {
          setOrder(snap.data() as OrderDoc);
        }
        setLoading(false);
      },
      (e) => {
        setErr(`Gagal memuat order: ${String(e?.message || e)}`);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [orderId]);

  const waypoints = useMemo(
    () => (order?.destinations || []).map((d) => d.coords || null),
    [order?.destinations]
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarAdmin />

      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-white hover:bg-gray-50 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Link>
          </div>

          <div className="text-sm text-gray-500">
            ID: <span className="font-mono">{orderId}</span>
          </div>
        </div>

        {loading ? (
          <div className="bg-white border rounded-lg p-4 text-sm text-gray-600">
            Memuat detail order…
          </div>
        ) : err ? (
          <div className="bg-white border rounded-lg p-4 text-sm text-red-600">
            {err}
          </div>
        ) : !order ? (
          <div className="bg-white border rounded-lg p-4 text-sm text-gray-600">
            Data tidak tersedia.
          </div>
        ) : (
          <>
            {/* Ringkasan */}
            <section className="grid lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2 bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h1 className="text-xl font-semibold">
                    Detail Order • {order.service?.toUpperCase() || "N/A"}
                  </h1>
                  <StatusBadge status={order.status} />
                </div>

                {/* Customer & Driver */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">
                      Customer
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>
                        {order.customer?.name || order.customer?.email || "-"}
                      </span>
                    </div>
                    <div className="text-[12px] text-gray-500 mt-1">
                      {order.customer?.email}
                    </div>
                  </div>

                  <div className="border rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">
                      Driver
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      <span>
                        {order.driver?.name ||
                          order.driver?.email ||
                          "Belum ditugaskan"}
                      </span>
                    </div>
                    <div className="text-[12px] text-gray-500 mt-1">
                      {order.driver?.email || "-"}
                    </div>
                  </div>
                </div>

                {/* Rute & waktu */}
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="border rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">
                      Rute
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <Route className="w-4 h-4" />
                      <span>{order.route?.distanceText || "-"}</span>
                    </div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">
                      Estimasi Waktu
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{order.route?.durationText || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* Waktu dibuat / ditugaskan */}
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <FieldTime
                    label="Dibuat"
                    value={order.createdAt?.toDate?.() as Date | undefined}
                  />
                  <FieldTime
                    label="Ditugaskan"
                    value={order.assignedAt?.toDate?.() as Date | undefined}
                  />
                </div>
              </div>

              {/* Biaya */}
              <div className="bg-white rounded-xl shadow p-4 h-max">
                <div className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <CircleDollarSign className="w-4 h-4" />
                  Estimasi Biaya
                </div>
                <div className="text-2xl font-bold">
                  {typeof order.fare?.total === "number"
                    ? formatIDR(order.fare!.total!)
                    : "-"}
                </div>
                <div className="text-xs text-gray-500 mt-2 space-y-1">
                  {typeof order.fare?.baseFare === "number" && (
                    <div>Dasar: {formatIDR(order.fare!.baseFare!)}</div>
                  )}
                  {typeof order.fare?.distanceFare === "number" && (
                    <div>Jarak: {formatIDR(order.fare!.distanceFare!)}</div>
                  )}
                  {typeof order.fare?.timeFare === "number" && (
                    <div>Waktu: {formatIDR(order.fare!.timeFare!)}</div>
                  )}
                  {typeof order.fare?.bookingFee === "number" && (
                    <div>Booking: {formatIDR(order.fare!.bookingFee!)}</div>
                  )}
                  {typeof order.fare?.surgeMultiplier === "number" &&
                    order.fare!.surgeMultiplier !== 1 && (
                      <div>Surge ×{order.fare!.surgeMultiplier}</div>
                    )}
                </div>
              </div>
            </section>

            {/* Lokasi & Peta */}
            <section className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-white rounded-xl shadow p-4">
                <div className="text-sm font-semibold mb-3">Lokasi</div>

                <div className="mb-3">
                  <label className="text-xs text-gray-500">Penjemputan</label>
                  <div className="text-sm">{order.pickup?.address || "-"}</div>
                  {order.pickup?.coords && (
                    <div className="text-[11px] text-gray-500">
                      ({order.pickup.coords.lat.toFixed(5)},{" "}
                      {order.pickup.coords.lng.toFixed(5)})
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-xs text-gray-500">Tujuan</div>
                  {(order.destinations || []).length === 0 ? (
                    <div className="text-sm text-gray-500">-</div>
                  ) : (
                    <ul className="space-y-2">
                      {order.destinations!.map((d, i) => (
                        <li key={i} className="text-sm">
                          <div>
                            #{i + 1} — {d.address || "-"}
                          </div>
                          {d.coords && (
                            <div className="text-[11px] text-gray-500">
                              ({d.coords.lat?.toFixed(5)},{" "}
                              {d.coords.lng?.toFixed(5)})
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl shadow p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Map className="w-4 h-4" />
                    Pratinjau Peta (read-only)
                  </div>
                </div>

                <div className="relative z-0 rounded-xl overflow-hidden border">
                  <OSMMapView
                    variant="streets"
                    center={
                      order.pickup?.coords || { lat: -1.25, lng: 124.45 } // fallback Bolsel
                    }
                    pickup={order.pickup?.coords || null}
                    waypoints={waypoints}
                    drawRoute={Boolean(
                      order.pickup?.coords && waypoints.some(Boolean)
                    )}
                    driverMarker={order.driver?.coords || null}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

/* --------- sub-komponen kecil --------- */

function FieldTime({ label, value }: { label: string; value?: Date }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
      <div className="text-sm">
        {value ? value.toLocaleString("id-ID") : "-"}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const cls =
    status === "searching"
      ? "bg-amber-100 text-amber-800"
      : status === "assigned" || status === "driver_arriving"
      ? "bg-blue-100 text-blue-800"
      : status === "ongoing"
      ? "bg-emerald-100 text-emerald-800"
      : status === "completed"
      ? "bg-gray-100 text-gray-700"
      : status === "cancelled"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-100 text-slate-700";
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded ${cls}`}>
      {status ?? "unknown"}
    </span>
  );
}
