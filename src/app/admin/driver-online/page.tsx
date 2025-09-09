"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import SidebarAdmin from "@/components/SidebarAdmin";
import {
  collection,
  onSnapshot,
  query,
  where,
  limit,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type Row = {
  uid: string;
  name?: string | null;
  email?: string | null;
  online?: boolean;
  coords?: { lat: number; lng: number } | null;
  updatedAt?: any; // Firestore Timestamp
};

// ⬇️ Render di client-only, bebas error "window is not defined"
const DriverOnlineMap = dynamic(() => import("./DriverOnlineMap"), {
  ssr: false,
});

function timeAgo(ts?: any) {
  if (!ts?.toDate) return "-";
  const d = ts.toDate() as Date;
  const diff = Math.max(0, Date.now() - d.getTime());
  const m = Math.round(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  return `${h} jam lalu`;
}

export default function AdminDriverOnlinePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = collection(db, "driverLocations");
    const q = query(ref, where("online", "==", true), limit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Row[] = [];
        snap.forEach((d: QueryDocumentSnapshot<DocumentData>) =>
          arr.push(d.data() as Row)
        );
        setRows(arr);
        setLoading(false);
      },
      (e) => {
        console.error("driver-online error:", e);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ta = a.updatedAt?.toDate?.().getTime?.() ?? 0;
      const tb = b.updatedAt?.toDate?.().getTime?.() ?? 0;
      return tb - ta;
    });
  }, [rows]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarAdmin />

      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <h1 className="text-2xl font-bold mb-4">
          Driver Online ({sorted.length})
        </h1>

        {/* PETA: client-only */}
        <div className="mb-6 rounded-xl overflow-hidden shadow border bg-white">
          <DriverOnlineMap rows={sorted} />
        </div>

        {/* TABEL */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2">Driver</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Koordinat</th>
                <th className="px-4 py-2">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-gray-500">
                    Memuat…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-gray-500">
                    Belum ada driver online.
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.uid} className="border-t">
                    <td className="px-4 py-3">{r.name || r.uid}</td>
                    <td className="px-4 py-3">{r.email || "-"}</td>
                    <td className="px-4 py-3">
                      {r.coords
                        ? `${r.coords.lat.toFixed(5)}, ${r.coords.lng.toFixed(
                            5
                          )}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">{timeAgo(r.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-[12px] text-gray-600">
          Data menggunakan TTL; saat driver offline & tidak update posisi,
          dokumen akan otomatis kadaluarsa/hilang.
        </div>
      </main>
    </div>
  );
}
