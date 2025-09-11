// src/app/driver/jobs/page.tsx
"use client";

import SidebarDriver from "@/components/SidebarDriver";
import { useEffect, useState } from "react";
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
import { Clock, Route, ArrowRight, Car } from "lucide-react";

type MyTask = {
  id: string;
  status: "assigned" | "driver_arriving" | "ongoing" | "completed" | string;
  service?: string;
  pickup?: { address?: string };
  destinations?: Array<{ address?: string }>;
  route?: { distanceText?: string; durationText?: string };
};

export default function DriverJobsPage() {
  const [items, setItems] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const ref = collection(db, "orders");
    // tugas saya yang belum selesai
    const q = query(
      ref,
      where("driver.uid", "==", uid),
      where("status", "!=", "completed"),
      orderBy("status"), // Firestore butuh orderBy utk "!="
      orderBy("updatedAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: MyTask[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setItems(arr);
        setLoading(false);
      },
      (e) => {
        console.error("driver tasks error:", e);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarDriver />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tugas Saya</h1>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Memuat…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-600">Belum ada tugas.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((o) => (
              <div
                key={o.id}
                className="bg-white border rounded-xl p-4 shadow-sm"
              >
                <div className="text-xs text-gray-500 mb-1">
                  {(o.service || "ride").toUpperCase()} • {o.status}
                </div>
                <div className="font-semibold text-sm">
                  {o.pickup?.address || "-"}
                </div>
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                  → {o.destinations?.[0]?.address || "—"}
                  {o.destinations && o.destinations.length > 1
                    ? ` (+${o.destinations.length - 1} tujuan)`
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
                  Buka
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
