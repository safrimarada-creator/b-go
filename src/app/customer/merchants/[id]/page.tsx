// src/app/customer/merchants/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SidebarCustomer from "@/components/SidebarCustomer";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  type Query,
  type QuerySnapshot,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import type { Merchant } from "@/types/merchant";
import { useCart } from "@/lib/cart";
import { formatIDR } from "@/lib/fare";

type Product = {
  id?: string;
  merchantId: string;
  name: string;
  price: number;
  photoUrl?: string | null;
  isActive?: boolean;
  createdAt?: any;
};

export default function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [idxWarn, setIdxWarn] = useState(false);

  const { cart, add, subtotal } = useCart(id);

  // Ambil info merchant sekali
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const ref = doc(db, "merchants", id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setMerchant({ id: snap.id, ...(snap.data() as any) });
        } else {
          setErr("Merchant tidak ditemukan.");
        }
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [id]);

  // Realtime produk merchant
  useEffect(() => {
    if (!id) return;

    let unsub: Unsubscribe | null = null;
    const ref = collection(db, "products");

    const attach = (qRef: Query<DocumentData>, isFallback = false) => {
      unsub = onSnapshot(
        qRef,
        (snap: QuerySnapshot<DocumentData>) => {
          // map & sort client jika fallback (tanpa orderBy)
          const arr = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Product),
          }));
          // jika tidak di-orderBy di server, urutkan di client pakai createdAt desc
          arr.sort((a, b) => {
            const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return tb - ta;
          });
          setItems(arr);
          setLoading(false);
        },
        (e: any) => {
          // Jika butuh index → fallback tanpa orderBy
          if (e?.code === "failed-precondition" && !isFallback) {
            setIdxWarn(true);
            if (unsub) unsub();
            const q2 = query(
              ref,
              where("merchantId", "==", id),
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

    // Query utama (butuh index): merchantId ==, isActive ==, orderBy createdAt desc
    const q1 = query(
      ref,
      where("merchantId", "==", id),
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    );
    attach(q1);

    return () => {
      if (unsub) unsub();
    };
  }, [id]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />

      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="mb-1">
          <h1 className="text-2xl font-bold">{merchant?.name || "Merchant"}</h1>
          <div className="text-sm text-gray-600">
            {merchant?.address || "-"}
          </div>
        </div>

        {idxWarn && (
          <div className="mt-3 mb-4 text-[12px] px-3 py-2 rounded border border-amber-300 bg-amber-50 text-amber-800">
            Query produk berjalan tanpa <b>orderBy</b> karena index belum
            dibuat. Buka halaman error Firestore dan buat index komposit untuk
            koleksi
            <code className="mx-1">products</code> dengan fields:
            <b className="mx-1">
              merchantId (Asc), isActive (Asc), createdAt (Desc)
            </b>
            .
          </div>
        )}

        {err && (
          <div className="mb-3 text-[13px] px-3 py-2 rounded border border-red-300 bg-red-50 text-red-700">
            {err}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-600">Memuat produk…</div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Produk */}
            <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
              {items.length === 0 ? (
                <div className="text-sm text-gray-600">
                  Belum ada produk aktif.
                </div>
              ) : (
                items.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-xl border overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.photoUrl || "/placeholder-product.jpg"}
                      alt=""
                      className="w-full h-36 object-cover"
                    />
                    <div className="p-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-gray-800">
                        {formatIDR(p.price)}
                      </div>
                      <button
                        onClick={() =>
                          add({ id: p.id!, name: p.name, price: p.price }, 1)
                        }
                        className="mt-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                      >
                        Tambah
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart */}
            <div className="bg-white rounded-xl border p-4 h-max">
              <div className="font-semibold mb-2">Keranjang</div>
              {cart.items.length === 0 ? (
                <div className="text-sm text-gray-600">Belum ada item.</div>
              ) : (
                <>
                  <ul className="divide-y">
                    {cart.items.map((it) => (
                      <li
                        key={it.id}
                        className="py-2 flex items-center justify-between text-sm"
                      >
                        <span>
                          {it.name} × {it.qty}
                        </span>
                        <span>{formatIDR(it.price * it.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 text-sm font-semibold">
                    Subtotal: {formatIDR(subtotal)}
                  </div>
                  <button
                    onClick={() =>
                      router.push(`/customer/checkout?merchant=${id}`)
                    }
                    className="mt-3 w-full px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                  >
                    Lanjut ke Checkout
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
