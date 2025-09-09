"use client";

import SidebarDriver from "@/components/SidebarDriver";
import { useDriverProfile } from "@/lib/useDriverProfile";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
import type { LatLng } from "@/lib/geo";
import { Clock, Route, ArrowRight, Car, Bike } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

type OrderListItem = {
  id: string;
  status: string;
  service: "ride" | "delivery";
  vehicleType?: "bike" | "car2" | "car3";
  pickup: { address: string; coords?: LatLng | null };
  destinations: { address: string; coords?: LatLng | null }[];
  route?: { distanceText?: string; durationText?: string };
};

function useAuthReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setReady(true));
    return () => unsub();
  }, []);
  return ready;
}

export default function DriverJobsPage() {
  const authReady = useAuthReady();
  const { profile, loading: loadingProfile } = useDriverProfile();
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // subscribe jobs sesuai vehicleType driver
  useEffect(() => {
    if (!authReady || loadingProfile) return;
    const vt = profile?.vehicleType || "bike";

    const ref = collection(db, "orders");
    // Syarat rules: driver hanya boleh baca 'searching' untuk service ride/delivery.
    // Maka query harus membatasi service agar tidak kena permission-denied.
    const q = query(
      ref,
      where("status", "==", "searching"),
      where("service", "in", ["ride", "delivery"]),
      where("vehicleType", "==", vt),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: OrderListItem[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setItems(arr);
        setLoading(false);
      },
      (e) => {
        console.error("jobs onSnapshot error:", e);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [authReady, loadingProfile, profile?.vehicleType]);

  const sorted = useMemo(() => items, [items]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarDriver />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pekerjaan Tersedia</h1>
          {!loadingProfile && (
            <div className="text-sm text-gray-600 inline-flex items-center gap-2">
              <span>Jenis kendaraan:</span>
              <span className="inline-flex items-center gap-1 font-medium">
                {profile?.vehicleType === "bike" ? (
                  <>
                    <Bike className="w-4 h-4" /> Motor
                  </>
                ) : profile?.vehicleType === "car2" ? (
                  <>
                    <Car className="w-4 h-4" /> Mobil (2 kursi)
                  </>
                ) : (
                  <>
                    <Car className="w-4 h-4" /> Mobil (3 kursi)
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Memuat…</div>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-gray-600">
            Belum ada order cocok untuk tipe kendaraanmu.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((o) => (
              <div
                key={o.id}
                className="bg-white border rounded-xl p-4 shadow-sm"
              >
                <div className="text-xs text-gray-500 mb-1">
                  {o.service?.toUpperCase() || "RIDE"} •{" "}
                  {o.vehicleType?.toUpperCase()}
                </div>
                <div className="font-semibold text-sm">
                  {o.pickup?.address || "Penjemputan tidak diketahui"}
                </div>
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                  → {o.destinations?.[0]?.address || "Tujuan 1"}
                  {o.destinations?.length > 1
                    ? ` (+${o.destinations.length - 1} tujuan lain)`
                    : ""}
                </div>

                {o.route?.distanceText && o.route?.durationText && (
                  <div className="mt-2 text-xs text-gray-600 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Route className="w-4 h-4" />
                      {o.route.distanceText}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {o.route.durationText}
                    </span>
                  </div>
                )}

                <Link
                  href={`/driver/order/${o.id}`}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                >
                  Buka & Ambil
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
