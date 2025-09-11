// src/app/customer/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import SidebarCustomer from "@/components/SidebarCustomer";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { formatIDR } from "@/lib/fare";

type Item = {
  id: string;
  service: "ride" | "delivery" | "merchant" | "laundry" | string;
  status: string;
  createdAt?: any;
  fare?: { total?: number };
  itemsSubtotal?: number;
  grandTotal?: number;
  merchant?: { name?: string };
  pickup?: { address?: string };
  destinations?: Array<{ address?: string }>;
};

export default function CustomerOrdersPage() {
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(
      collection(db, "orders"),
      where("customer.uid", "==", uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Item[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setRows(arr);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <h1 className="text-2xl font-bold mb-3">Pesanan Saya</h1>
        {loading ? (
          <div className="text-sm text-gray-600">Memuat…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-600">Belum ada pesanan.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((o) => (
              <Link
                key={o.id}
                href={`/customer/order/${o.id}`}
                className="bg-white rounded-xl border p-4 hover:shadow-sm"
              >
                <div className="text-xs text-gray-500">
                  {o.service.toUpperCase()} • {o.status}
                </div>
                {o.service === "merchant" ? (
                  <>
                    <div className="mt-1 font-semibold text-sm">
                      {o.merchant?.name || "Merchant"}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Total:{" "}
                      {o.grandTotal != null
                        ? formatIDR(o.grandTotal)
                        : o.fare?.total != null
                        ? formatIDR(o.fare.total)
                        : "-"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-1 text-sm">
                      {o.pickup?.address || "-"} →{" "}
                      {o.destinations?.[0]?.address || "-"}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Ongkir:{" "}
                      {o.fare?.total != null ? formatIDR(o.fare.total) : "-"}
                    </div>
                  </>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
