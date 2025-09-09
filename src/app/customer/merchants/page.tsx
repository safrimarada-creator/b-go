// src/app/customer/merchants/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SidebarCustomer from "@/components/SidebarCustomer";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import type { Merchant } from "@/types/merchant";
import { Search, Store } from "lucide-react";

export default function CustomerMerchantsPage() {
  const [rows, setRows] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [qText, setQText] = useState("");

  useEffect(() => {
    const qy = query(collection(db, "merchants"), orderBy("name", "asc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const arr: Merchant[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setRows(arr.filter((r) => r.isActive !== false));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!qText) return rows;
    const v = qText.toLowerCase();
    return rows.filter(
      (m) =>
        m.name?.toLowerCase().includes(v) ||
        m.category?.toLowerCase().includes(v) ||
        m.address?.toLowerCase().includes(v)
    );
  }, [rows, qText]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Store className="w-6 h-6 text-emerald-600" />
          <span>Pilih Merchant</span>
        </h1>

        <div className="mb-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Cari nama/kategori/alamat…"
            className="pl-9 pr-3 py-2 rounded-md border bg-white text-sm w-full max-w-lg"
          />
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Memuat…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-600">Belum ada merchant.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <Link
                key={m.id}
                href={`/customer/merchants/${m.id}`}
                className="bg-white rounded-xl border shadow-sm hover:shadow p-4 block"
              >
                <div className="flex items-center gap-3">
                  {m.photoUrl ? (
                    <img
                      src={m.photoUrl}
                      alt=""
                      className="w-14 h-14 rounded object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded bg-gray-100" />
                  )}
                  <div>
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-xs text-gray-500">
                      {m.category || "-"}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-2 line-clamp-2">
                  {m.address || "-"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
