"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import SidebarCustomer from "@/components/SidebarCustomer";

import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  Unsubscribe,
  type Query,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";

import type { Merchant, LatLng } from "@/types/merchant";
import { haversine, formatDistance } from "@/lib/geo";
import { Store, Search, MapPin, AlertTriangle, Filter } from "lucide-react";

// (opsional) peta mini pada tiap kartu bisa ditambahkan belakangan.
// const OSMMapView = dynamic(() => import("@/components/OSMMapView"), { ssr: false });

export default function CustomerMerchantsPage() {
  const [items, setItems] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [myLoc, setMyLoc] = useState<LatLng | null>(null);
  const [sortByNearest, setSortByNearest] = useState(true);

  const [idxWarn, setIdxWarn] = useState(false); // peringatan kalau fallback tanpa index
  const [qText, setQText] = useState("");
  const [cat, setCat] = useState<string>("all");

  // Ambil lokasi user (agar bisa hitung jarak ke merchant)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // abaikan; user bisa tolak ijin
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  }, []);

  // Realtime merchants (aktif). Coba query dengan orderBy(createdAt desc).
  // Jika butuh index (failed-precondition), fallback ke query tanpa orderBy.
  useEffect(() => {
    setLoading(true);
    setErr(null);
    setIdxWarn(false);

    const ref = collection(db, "merchants");

    let unsub: Unsubscribe | null = null;

    const attach = (qRef: Query<DocumentData>, isFallback = false) => {
      unsub = onSnapshot(
        qRef,
        (snap: QuerySnapshot<DocumentData>) => {
          const arr: Merchant[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Merchant),
          }));
          setItems(arr);
          setLoading(false);
        },
        (e: any) => {
          if (e?.code === "failed-precondition" && !isFallback) {
            setIdxWarn(true);
            if (unsub) unsub();
            const q2 = query(
              collection(db, "merchants"),
              where("isActive", "==", true)
            );
            attach(q2, true);
            return;
          }
          setErr(String(e?.message || e));
          setLoading(false);
        }
      );
    };

    const q1 = query(
      ref,
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    );
    attach(q1);

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Daftar kategori dari data
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return ["all", ...Array.from(set)];
  }, [items]);

  // Filter & sort di client
  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    let rows = items.filter((m) => {
      if (cat !== "all" && (m.category || "") !== cat) return false;
      if (t) {
        const hay = `${m.name || ""} ${m.address || ""} ${
          m.category || ""
        }`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });

    // tambahkan jarak (meter) jika myLoc & merchant coords ada
    if (myLoc) {
      rows = rows.map((m) => {
        const d =
          m.coords &&
          typeof m.coords.lat === "number" &&
          typeof m.coords.lng === "number"
            ? haversine(myLoc, m.coords)
            : Number.POSITIVE_INFINITY;
        return { ...m, _dist: d as any };
      });
    }

    // Sort
    rows.sort((a: any, b: any) => {
      if (sortByNearest && myLoc) {
        // nearest
        const da = a._dist ?? Number.POSITIVE_INFINITY;
        const db = b._dist ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
      }
      // fallback: createdAt desc
      const ta = (a as any).createdAt?.toMillis?.() ?? 0;
      const tb = (b as any).createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });

    return rows;
  }, [items, qText, cat, sortByNearest, myLoc]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />

      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="w-6 h-6 text-emerald-600" />
            <span>Merchant Terdekat</span>
          </h1>
        </div>

        {/* Bar tools: search, kategori, sort */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="sr-only">Cari merchant</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Cari merchant, alamat, kategori…"
                className="w-full pl-9 pr-3 py-2 rounded-md border bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="appearance-none pl-9 pr-8 py-2 rounded-md border bg-white"
                title="Filter kategori"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "Semua Kategori" : c}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                ▼
              </span>
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sortByNearest}
                onChange={(e) => setSortByNearest(e.target.checked)}
              />
              Urutkan terdekat
            </label>
          </div>
        </div>

        {/* Peringatan index */}
        {idxWarn && (
          <div className="mb-3 text-[13px] px-3 py-2 rounded border border-amber-300 bg-amber-50 text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <div>
              Query tanpa <i>orderBy(createdAt)</i> karena index belum dibuat.
              Untuk performa optimal, buat composite index pada koleksi{" "}
              <code>merchants</code> dengan fields:
              <b> isActive (Asc), createdAt (Desc)</b> di Firebase Console.
            </div>
          </div>
        )}

        {/* Error */}
        {err && (
          <div className="mb-3 text-[13px] px-3 py-2 rounded border border-red-300 bg-red-50 text-red-700">
            {err}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-sm text-gray-600">Memuat merchants…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-600">
            Tidak ada merchant yang cocok.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => {
              const dist =
                myLoc && m.coords ? haversine(myLoc, m.coords) : null;

              return (
                <Link
                  key={m.id}
                  href={`/customer/merchants/${m.id}`}
                  className="block bg-white rounded-xl border overflow-hidden hover:shadow transition"
                >
                  {/* Foto */}
                  <div className="aspect-[16/9] bg-gray-100">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.photoUrl}
                        alt={m.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        (Tidak ada foto)
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <div className="text-sm font-semibold">{m.name}</div>
                    <div className="text-[12px] text-gray-500">
                      {m.category || "Umum"}
                    </div>
                    <div className="mt-1 text-[12px] text-gray-600 flex items-center gap-1 line-clamp-1">
                      <MapPin className="w-3 h-3" />
                      <span>{m.address || "-"}</span>
                    </div>
                    {dist != null && isFinite(dist) && (
                      <div className="mt-1 text-[12px] text-gray-600">
                        Jarak: {formatDistance(dist)}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
