// src/app/driver/jobs/page.tsx
"use client";

import SidebarDriver from "@/components/SidebarDriver";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  type Query,
  type Unsubscribe,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Clock, Route, ArrowRight } from "lucide-react";
import { useDriverPresence } from "@/lib/driverPresence";

type LatLng = { lat: number; lng: number };
type Job = {
  id: string;
  status: string;
  service?: string;
  pickup?: { address?: string; coords?: LatLng | null };
  destinations?: Array<{ address?: string }>;
  route?: { distanceText?: string; durationText?: string };
  updatedAt?: any;
  createdAt?: any;
};

function useAuthReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setReady(true));
    return () => unsub();
  }, []);
  return ready;
}

function haversine(a: LatLng, b: LatLng) {
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
function formatDistance(m: number) {
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function DriverJobsPage() {
  const authReady = useAuthReady();
  const { myLoc } = useDriverPresence();

  // daftar untuk diambil
  const [available, setAvailable] = useState<Job[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [errAvail, setErrAvail] = useState<string | null>(null);

  // daftar aktif saya
  const [myActive, setMyActive] = useState<Job[]>([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [errActive, setErrActive] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const ref = collection(db, "orders");
    let unsubAvail: Unsubscribe | null = null;
    let unsubActive: Unsubscribe | null = null;

    // ---- LISTEN AVAILABLE (status searching + candidateUids contains me)
    const attachAvail = (qq: Query) => {
      unsubAvail = onSnapshot(
        qq,
        (snap) => {
          const arr: Job[] = [];
          snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
          setAvailable(arr);
          setLoadingAvail(false);
          setErrAvail(null);
        },
        (e: any) => {
          if (e?.code === "failed-precondition") {
            // fallback tanpa orderBy (sort di client)
            const q2 = query(
              ref,
              where("status", "==", "searching"),
              where("candidateUids", "array-contains", uid),
              limit(100)
            );
            // pasang fallback satu kali
            unsubAvail && unsubAvail();
            unsubAvail = onSnapshot(
              q2,
              (snap) => {
                const arr: Job[] = [];
                snap.forEach((d) =>
                  arr.push({ id: d.id, ...(d.data() as any) })
                );
                // sort client pakai createdAt desc jika ada
                arr.sort((a, b) => {
                  const ta = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
                  const tb = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
                  return tb - ta;
                });
                setAvailable(arr);
                setLoadingAvail(false);
                setErrAvail(null);
              },
              (e2) => {
                setErrAvail(String(e2?.message || e2));
                setLoadingAvail(false);
              }
            );
            return;
          }
          setErrAvail(String(e?.message || e));
          setLoadingAvail(false);
        }
      );
    };

    const qAvail = query(
      ref,
      where("status", "==", "searching"),
      where("candidateUids", "array-contains", uid),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    attachAvail(qAvail);

    // ---- LISTEN MY ACTIVE (driver.uid == me + status IN [assigned, driver_arriving, ongoing])
    const activeStatuses = ["assigned", "driver_arriving", "ongoing"];
    const attachActive = (qq: Query, useClientSort = false) => {
      unsubActive = onSnapshot(
        qq,
        (snap) => {
          const arr: Job[] = [];
          snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
          if (useClientSort) {
            arr.sort((a, b) => {
              const ta = a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
              const tb = b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
              return tb - ta;
            });
          }
          setMyActive(arr);
          setLoadingActive(false);
          setErrActive(null);
        },
        (e: any) => {
          if (e?.code === "failed-precondition") {
            // fallback: tanpa orderBy, sort di client
            const q2 = query(
              ref,
              where("driver.uid", "==", uid),
              where("status", "in", activeStatuses as any),
              limit(100)
            );
            unsubActive && unsubActive();
            attachActive(q2, true);
            return;
          }
          setErrActive(String(e?.message || e));
          setLoadingActive(false);
        }
      );
    };

    const qActive = query(
      ref,
      where("driver.uid", "==", uid),
      where("status", "in", activeStatuses as any),
      orderBy("updatedAt", "desc"),
      limit(100)
    );
    attachActive(qActive);

    return () => {
      if (unsubAvail) unsubAvail();
      if (unsubActive) unsubActive();
    };
  }, [authReady]);

  // Urutkan berdasarkan kedekatan (kalau lokasi aktif)
  const availableSorted = useMemo(() => {
    if (!myLoc) return available;
    return [...available]
      .map((o) => ({
        ...o,
        _d: o.pickup?.coords ? haversine(myLoc, o.pickup.coords) : Infinity,
      }))
      .sort((a, b) => (a._d as number) - (b._d as number));
  }, [available, myLoc]);

  const myActiveSorted = useMemo(() => {
    if (!myLoc) return myActive;
    return (
      [...myActive]
        .map((o) => ({
          ...o,
          _d: o.pickup?.coords ? haversine(myLoc, o.pickup.coords) : Infinity,
        }))
        // aktif: lebih berguna kalau urutkan waktu update desc, lalu jarak
        .sort((a, b) => {
          const tb =
            b.updatedAt?.toDate?.()?.getTime?.() ??
            b.createdAt?.toDate?.()?.getTime?.() ??
            0;
          const ta =
            a.updatedAt?.toDate?.()?.getTime?.() ??
            a.createdAt?.toDate?.()?.getTime?.() ??
            0;
          if (tb !== ta) return tb - ta;
          return (a._d as number) - (b._d as number);
        })
    );
  }, [myActive, myLoc]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarDriver />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Daftar Tugas</h1>
          {!myLoc && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
              Aktifkan lokasi supaya jarak dapat dihitung.
            </div>
          )}
        </div>

        {/* TUGAS AKTIF SAYA */}
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Tugas Aktif Saya
              <span className="ml-2 text-xs text-gray-500">
                ({myActiveSorted.length})
              </span>
            </h2>
          </div>

          {errActive && (
            <div className="text-sm text-red-600 mb-3">Error: {errActive}</div>
          )}

          {loadingActive ? (
            <div className="text-sm text-gray-600">Memuat…</div>
          ) : myActiveSorted.length === 0 ? (
            <div className="text-sm text-gray-600">
              Belum ada tugas aktif. Ambil order baru ketika tersedia.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myActiveSorted.map((o) => (
                <JobCard key={o.id} job={o} myLoc={myLoc} />
              ))}
            </div>
          )}
        </section>

        {/* TUGAS UNTUK DIAMBIL */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Tugas untuk Diambil
              <span className="ml-2 text-xs text-gray-500">
                ({availableSorted.length})
              </span>
            </h2>
          </div>

          {errAvail && (
            <div className="text-sm text-red-600 mb-3">Error: {errAvail}</div>
          )}

          {loadingAvail ? (
            <div className="text-sm text-gray-600">Memuat…</div>
          ) : availableSorted.length === 0 ? (
            <div className="text-sm text-gray-600">
              Belum ada broadcast untukmu saat ini.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableSorted.map((o) => (
                <JobCard key={o.id} job={o} myLoc={myLoc} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* ---------- Kartu job kecil ---------- */
function JobCard({
  job,
  myLoc,
}: {
  job: Job;
  myLoc: LatLng | null | undefined;
}) {
  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm">
      <div className="text-xs text-gray-500 mb-1">
        {(job.service || "merchant").toUpperCase()} • {job.status}
      </div>
      <div className="font-semibold text-sm">{job.pickup?.address || "-"}</div>
      <div className="text-xs text-gray-600 mt-1 line-clamp-2">
        → {job.destinations?.[0]?.address || "—"}
        {job.destinations && job.destinations.length > 1
          ? ` (+${job.destinations.length - 1} tujuan)`
          : ""}
      </div>

      <div className="mt-2 text-xs text-gray-600 flex items-center gap-3">
        {myLoc && job.pickup?.coords && (
          <span className="inline-flex items-center gap-1">
            <Route className="w-4 h-4" />
            {formatDistance(haversine(myLoc, job.pickup.coords))}
          </span>
        )}
        {job.route?.durationText && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {job.route.durationText}
          </span>
        )}
      </div>

      <Link
        href={`/driver/order/${job.id}`}
        className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
      >
        Buka
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
