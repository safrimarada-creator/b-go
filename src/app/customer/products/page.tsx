// src/app/customer/products/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SidebarCustomer from "@/components/SidebarCustomer";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  type Query,
  type QuerySnapshot,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { useCart } from "@/lib/cart";
import { formatIDR } from "@/lib/fare";
import {
  Search,
  ShoppingBag,
  Star,
  AlertCircle,
  Store,
  ChevronRight,
} from "lucide-react";

// Tipe produk ringkas
type Product = {
  id?: string;
  merchantId: string;
  name: string;
  price: number;
  photoUrl?: string | null;
  isActive?: boolean;
  category?: string;
  createdAt?: any;
};

// Ringkasan merchant (hanya nama/foto)
type MerchantLite = {
  id: string;
  name: string;
  photoUrl?: string | null;
  address?: string;
  isActive?: boolean;
};

// Kategori untuk chip filter
const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "food", label: "Makanan" },
  { key: "beverage", label: "Minuman" },
  { key: "groceries", label: "Sembako" },
  { key: "laundry", label: "Laundry" },
  { key: "others", label: "Lainnya" },
];

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [idxWarn, setIdxWarn] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<Product[]>([]);
  const [merchants, setMerchants] = useState<Record<string, MerchantLite>>({});

  // Keranjang global via useCart
  const { cart, subtotal } = useCart();

  /**
   * Subscribe produk aktif dengan fallback ketika index belum ada.
   * Jika filter kategori selain "all", masukkan where("category", "==", category).
   */
  useEffect(() => {
    let unsub: Unsubscribe | null = null;
    setLoading(true);
    setErr(null);
    setIdxWarn(false);

    const ref = collection(db, "products");

    const makeQuery = (isFallback = false): Query<DocumentData> => {
      if (!isFallback) {
        return category === "all"
          ? query(
              ref,
              where("isActive", "==", true),
              orderBy("createdAt", "desc"),
              limit(60)
            )
          : query(
              ref,
              where("isActive", "==", true),
              where("category", "==", category),
              orderBy("createdAt", "desc"),
              limit(60)
            );
      }
      // fallback tanpa orderBy
      return category === "all"
        ? query(ref, where("isActive", "==", true), limit(60))
        : query(
            ref,
            where("isActive", "==", true),
            where("category", "==", category),
            limit(60)
          );
    };

    const attach = (qRef: Query<DocumentData>, isFallback = false) => {
      unsub = onSnapshot(
        qRef,
        (snap: QuerySnapshot<DocumentData>) => {
          let arr = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Product),
          }));
          // jika fallback, urutkan manual
          if (isFallback) {
            arr.sort((a, b) => {
              const ta =
                a.createdAt?.toDate && typeof a.createdAt?.toDate === "function"
                  ? a.createdAt.toDate().getTime()
                  : 0;
              const tb =
                b.createdAt?.toDate && typeof b.createdAt?.toDate === "function"
                  ? b.createdAt.toDate().getTime()
                  : 0;
              return tb - ta;
            });
          }
          setItems(arr);
          setLoading(false);
          // muat nama merchant
          const mids = Array.from(
            new Set(arr.map((p) => p.merchantId).filter(Boolean))
          );
          if (mids.length)
            loadMerchantsLite(mids)
              .then(setMerchants)
              .catch(() => {});
        },
        (e: any) => {
          // Jika butuh index, fallback
          if (e?.code === "failed-precondition" && !isFallback) {
            setIdxWarn(true);
            if (unsub) unsub();
            attach(makeQuery(true), true);
            return;
          }
          setErr(String(e?.message || e));
          setLoading(false);
        }
      );
    };

    attach(makeQuery(), false);
    return () => {
      if (unsub) unsub();
    };
  }, [category]);

  // Filter pencarian di sisi client (tidak butuh index)
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((p) => p.name?.toLowerCase()?.includes(s));
  }, [items, search]);

  // Apakah butuh hints index
  const showIdxHint = idxWarn;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />

      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">🛍️ Belanja Produk</h1>
          {/* keranjang pill (desktop) */}
          <Link
            href="/customer/checkout"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-600 text-white text-sm hover:bg-emerald-700"
            title="Buka Keranjang"
          >
            <ShoppingBag className="w-4 h-4" />
            Keranjang
            {cart.items.length > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {cart.items.length}
              </span>
            )}
          </Link>
        </div>

        <p className="text-gray-600 mb-4">
          Cari dan pesan produk dari berbagai merchant sekitar Anda.
        </p>

        {/* Pencarian */}
        <div className="relative mb-4 max-w-xl">
          <input
            type="text"
            placeholder="Cari produk atau kata kunci…"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
        </div>

        {/* Kategori (chips) */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={[
                "px-3 py-1.5 rounded-full border text-sm",
                category === c.key
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white hover:bg-gray-50",
              ].join(" ")}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Peringatan index */}
        {showIdxHint && (
          <div className="mb-4 text-[12px] px-3 py-2 rounded border border-amber-300 bg-amber-50 text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Query berjalan tanpa <b>orderBy</b> karena index komposit belum
              dibuat. Untuk kecepatan optimal: buat index koleksi
              <code className="mx-1">products</code> dengan field:
              <b>isActive (Asc)</b>
              {category !== "all" && ", "}
              {category !== "all" && (
                <>
                  <b>category (Asc)</b>,{" "}
                </>
              )}
              <b>createdAt (Desc)</b>.
            </span>
          </div>
        )}

        {/* Error */}
        {err && (
          <div className="mb-4 text-[13px] px-3 py-2 rounded border border-rose-300 bg-rose-50 text-rose-700">
            {err}
          </div>
        )}

        {/* Grid produk */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-white p-3 animate-pulse"
              >
                <div className="w-full h-36 rounded-lg bg-gray-200" />
                <div className="mt-3 h-4 w-2/3 bg-gray-200 rounded" />
                <div className="mt-2 h-3 w-1/3 bg-gray-200 rounded" />
                <div className="mt-3 h-8 w-24 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-600">
            Tidak ada produk yang cocok.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} p={p} m={merchants[p.merchantId]} />
            ))}
          </div>
        )}

        {/* CTA lihat semua merchant */}
        <div className="mt-8">
          <Link
            href="/customer/merchants"
            className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-800 text-sm"
          >
            <Store className="w-4 h-4" />
            Lihat semua merchant
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Floating cart (mobile) */}
        <Link
          href="/customer/checkout"
          className="fixed bottom-4 right-4 sm:hidden inline-flex items-center gap-2 px-4 py-3 rounded-full shadow-md bg-emerald-600 text-white"
        >
          <ShoppingBag className="w-5 h-5" />
          {cart.items.length > 0 ? (
            <>
              {cart.items.length} • {formatIDR(subtotal)}
            </>
          ) : (
            "Keranjang"
          )}
        </Link>
      </main>
    </div>
  );
}

/* ----------------- Kartu produk ----------------- */
function ProductCard({ p, m }: { p: Product; m?: MerchantLite }) {
  return (
    <Link
      href={`/customer/merchants/${p.merchantId}`}
      className="group bg-white border rounded-xl overflow-hidden hover:shadow-sm transition"
    >
      {/* Gambar produk */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.photoUrl || "/placeholder-product.jpg"}
        alt={p.name}
        className="w-full h-40 object-cover"
      />
      <div className="p-3">
        <div className="text-sm font-semibold group-hover:text-emerald-700 line-clamp-2">
          {p.name}
        </div>
        <div className="mt-1 text-[13px] text-gray-600">
          {m?.name || "Merchant"}
        </div>
        <div className="mt-2 font-bold">{formatIDR(p.price)}</div>
        <div className="mt-2 text-[12px] text-gray-500 inline-flex items-center gap-1">
          <Star className="w-4 h-4 text-amber-500" />
          4.8 • Populer
        </div>
      </div>
    </Link>
  );
}

/* ----------------- Ambil nama merchant (lite) ----------------- */
async function loadMerchantsLite(
  ids: string[]
): Promise<Record<string, MerchantLite>> {
  if (!ids.length) return {};
  const out: Record<string, MerchantLite> = {};
  const { doc, getDoc } = await import("firebase/firestore");
  await Promise.all(
    ids.map(async (id) => {
      try {
        const ref = doc(db, "merchants", id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data() as any;
          out[id] = {
            id: snap.id,
            name: d.name,
            photoUrl: d.photoUrl,
            address: d.address,
            isActive: d.isActive,
          };
        }
      } catch {
        // abaikan
      }
    })
  );
  return out;
}
