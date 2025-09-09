"use client";

import { useEffect, useState } from "react";
import SidebarAdmin from "@/components/SidebarAdmin";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  where,
  query,
  Timestamp,
} from "firebase/firestore";
import Link from "next/link";
import { Users, MapPin, Clock } from "lucide-react";

type DriverLoc = {
  uid: string;
  online?: boolean;
  coords?: { lat: number; lng: number } | null;
  updatedAt?: Timestamp;
};

export default function AdminDriversPage() {
  const [rows, setRows] = useState<Array<{ id: string; data: DriverLoc }>>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    const q = query(
      collection(db, "driverLocations"),
      where("online", "==", true),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => ({ id: d.id, data: d.data() as DriverLoc }))
        );
      },
      (e) => setErr(String(e?.message || e))
    );
    return () => unsub();
  }, []);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarAdmin />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>Driver Online</span>
          </h1>
          <Link
            href="/admin"
            className="text-sm px-3 py-2 rounded-md border hover:bg-gray-50"
          >
            Kembali
          </Link>
        </div>

        {err && (
          <div className="mb-3 text-[13px] px-3 py-2 rounded border border-red-300 bg-red-50 text-red-700">
            {err}
          </div>
        )}

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2">UID</th>
                <th className="px-4 py-2">Koordinat</th>
                <th className="px-4 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-gray-500" colSpan={3}>
                    Tidak ada driver online.
                  </td>
                </tr>
              ) : (
                rows.map(({ id, data }) => {
                  const t = data.updatedAt?.toDate?.() as Date | undefined;
                  return (
                    <tr key={id} className="border-t">
                      <td className="px-4 py-2 font-mono">{id}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {data.coords
                            ? `${data.coords.lat.toFixed(
                                5
                              )}, ${data.coords.lng.toFixed(5)}`
                            : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          <Clock className="w-4 h-4" />
                          {t ? t.toLocaleString("id-ID") : "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
