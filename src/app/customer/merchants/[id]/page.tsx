// src/app/customer/merchants/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import SidebarCustomer from "@/components/SidebarCustomer";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  addDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { Merchant } from "@/types/merchant";
import type { Product } from "@/types/product";
import AutocompleteInputOSM from "@/components/AutocompleteInputOSM";
import type { LatLng } from "@/lib/osm";
import { usePricing } from "@/lib/usePricing";
import { calculateFare, formatIDR } from "@/lib/fare";
import {
  Bike,
  Store,
  ShoppingCart,
  Plus,
  Minus,
  MapPin,
  Route,
  Clock,
} from "lucide-react";

// peta client-side
const OSMMapView = dynamic(() => import("@/components/OSMMapView"), {
  ssr: false,
});

type CartItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  unit?: string;
  subtotal: number;
};

export default function CustomerMerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // keranjang
  const [cart, setCart] = useState<CartItem[]>([]);

  // alamat pengantaran
  const [address, setAddress] = useState("");
  const [dropCoords, setDropCoords] = useState<LatLng | null>(null);
  const [note, setNote] = useState("");

  // info rute (merchant → drop)
  const [routeInfo, setRouteInfo] = useState<{
    distanceText: string;
    durationText: string;
    distanceValue: number;
    durationValue: number;
  } | null>(null);

  // tarif
  const { pricing } = usePricing();

  // muat merchant
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "merchants", id), (snap) => {
      setMerchant(
        snap.exists()
          ? ({ id: snap.id, ...(snap.data() as any) } as Merchant)
          : null
      );
    });
    return () => unsub();
  }, [id]);

  // muat produk merchant
  useEffect(() => {
    if (!id) return;
    const qy = query(
      collection(db, "products"),
      where("merchantId", "==", id),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(qy, (snap) => {
      const arr: Product[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setProducts(arr.filter((p) => p.isActive !== false));
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  // add / minus item
  function addItem(p: Product) {
    setCart((prev) => {
      const ex = prev.find((x) => x.productId === (p.id as string));
      if (ex) {
        return prev.map((x) =>
          x.productId === p.id
            ? { ...x, qty: x.qty + 1, subtotal: (x.qty + 1) * x.price }
            : x
        );
      }
      return [
        ...prev,
        {
          productId: p.id as string,
          name: p.name,
          price: p.price,
          unit: p.unit,
          qty: 1,
          subtotal: p.price,
        },
      ];
    });
  }
  function decItem(pid: string) {
    setCart((prev) =>
      prev
        .map((x) =>
          x.productId === pid
            ? {
                ...x,
                qty: Math.max(0, x.qty - 1),
                subtotal: Math.max(0, x.qty - 1) * x.price,
              }
            : x
        )
        .filter((x) => x.qty > 0)
    );
  }

  const itemsTotal = useMemo(
    () => cart.reduce((s, i) => s + i.subtotal, 0),
    [cart]
  );

  // ongkir berdasar rute (kalau merchant.coords & dropCoords ada)
  const deliveryFee = useMemo(() => {
    if (!pricing) return null;

    // jika rute tersedia → hitung pakai fare (anggap kendaraan motor)
    if (routeInfo) {
      const overrides = { ...pricing }; // gunakan pricing apa adanya
      const fee = calculateFare(
        routeInfo.distanceValue,
        routeInfo.durationValue,
        overrides
      );
      return fee.total;
    }

    // jika tidak ada rute, fallback bookingFee
    return pricing.bookingFee ?? 0;
  }, [pricing, routeInfo]);

  // checkout → buat order
  async function checkout() {
    if (!merchant?.id) {
      alert("Merchant tidak ditemukan.");
      return;
    }
    if (cart.length === 0) {
      alert("Keranjang masih kosong.");
      return;
    }
    if (!dropCoords) {
      alert("Isi alamat pengantaran.");
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) {
      alert("Sesi Firebase belum aktif. Silakan muat ulang / login.");
      return;
    }

    const items = cart.map((c) => ({
      productId: c.productId,
      name: c.name,
      price: c.price,
      qty: c.qty,
      unit: c.unit || null,
      subtotal: c.subtotal,
    }));

    const total = itemsTotal + (deliveryFee ?? 0);

    const payload = {
      service: "merchant",
      status: "searching" as const,
      createdAt: serverTimestamp(),

      // ringkas merchant
      merchant: {
        id: merchant.id,
        name: merchant.name,
        address: merchant.address || null,
        coords: merchant.coords || null,
      },

      // pemesanan
      items,
      totals: {
        currency: "IDR",
        itemsTotal,
        deliveryFee: deliveryFee ?? 0,
        grandTotal: total,
      },
      notes: note || null,

      // rute → gunakan format halaman tracking: pickup + destinations[]
      pickup: {
        address: merchant.address || merchant.name,
        coords: merchant.coords || null,
      },
      destinations: [
        {
          address,
          coords: dropCoords,
        },
      ],
      route: routeInfo
        ? {
            distanceText: routeInfo.distanceText,
            durationText: routeInfo.durationText,
            distanceValue: routeInfo.distanceValue,
            durationValue: routeInfo.durationValue,
          }
        : null,

      customer: {
        uid,
        name: auth.currentUser?.displayName || null,
        email: auth.currentUser?.email || null,
      },

      driver: null,
    };

    const ref = await addDoc(collection(db, "orders"), payload);
    router.push(`/customer/order/${ref.id}`);
  }

  const canDrawRoute = Boolean(merchant?.coords && dropCoords);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />

      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        {/* header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="w-6 h-6 text-emerald-600" />
            <span>{merchant?.name || "Merchant"}</span>
          </h1>
          <Link
            href="/customer/merchants"
            className="text-sm text-emerald-700 underline"
          >
            ← Kembali
          </Link>
        </div>

        {/* info merchant ringkas */}
        <div className="mb-4 bg-white rounded-xl shadow p-4">
          <div className="text-sm text-gray-700">
            <div className="font-semibold">{merchant?.category || "-"}</div>
            <div className="text-xs text-gray-600">
              {merchant?.address || "-"}
            </div>
            {merchant?.coords ? (
              <div className="text-[11px] text-gray-500 mt-1">
                Koordinat tersedia — rute & ongkir dihitung otomatis.
              </div>
            ) : (
              <div className="text-[11px] text-amber-700 mt-1">
                Merchant belum punya koordinat. Ongkir memakai booking fee.
              </div>
            )}
          </div>
        </div>

        {/* grid: daftar produk + panel keranjang/antar */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* daftar produk */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow p-4">
            <h2 className="text-sm font-semibold mb-3">Produk</h2>

            {loading ? (
              <div className="text-sm text-gray-500">Memuat…</div>
            ) : products.length === 0 ? (
              <div className="text-sm text-gray-500">Belum ada produk.</div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {products.map((p) => (
                  <div key={p.id} className="border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      {p.photoUrl ? (
                        <img
                          src={p.photoUrl}
                          className="w-16 h-16 rounded object-cover"
                          alt=""
                        />
                      ) : (
                        <div className="w-16 h-16 rounded bg-gray-100" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-gray-600 truncate">
                          {p.description || ""}
                        </div>
                        <div className="text-sm font-semibold mt-1">
                          {formatIDR(p.price)}
                          {p.unit ? ` / ${p.unit}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <button
                        onClick={() => addItem(p)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-sm"
                      >
                        <Plus className="w-4 h-4" /> Tambah
                      </button>

                      {/* qty cepat bila ada di cart */}
                      {cart.find((x) => x.productId === p.id) && (
                        <div className="inline-flex items-center border rounded-md">
                          <button
                            onClick={() => decItem(p.id as string)}
                            className="px-2 py-1"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="px-3 text-sm">
                            {cart.find((x) => x.productId === p.id)?.qty}
                          </span>
                          <button
                            onClick={() => addItem(p)}
                            className="px-2 py-1"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* panel keranjang & pengantaran */}
          <div className="bg-white rounded-xl shadow p-4 h-max">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Keranjang
            </h2>

            {cart.length === 0 ? (
              <div className="text-sm text-gray-500">Belum ada item.</div>
            ) : (
              <div className="space-y-2">
                {cart.map((c) => (
                  <div
                    key={c.productId}
                    className="flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {formatIDR(c.price)} {c.unit ? `/ ${c.unit}` : ""} ×{" "}
                        {c.qty}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      {formatIDR(c.subtotal)}
                    </div>
                  </div>
                ))}
                <div className="border-t my-2" />
                <div className="flex items-center justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-semibold">{formatIDR(itemsTotal)}</span>
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="label-xs">Alamat Pengantaran</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <AutocompleteInputOSM
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Cari alamat pengantaran"
                    icon={<MapPin className="w-4 h-4" />}
                    onPlaceSelected={({ address, lat, lng }) => {
                      setAddress(address);
                      setDropCoords({ lat, lng });
                    }}
                  />
                </div>
                {/* tombol pilih di peta opsional sudah ada di komponen lain; di sini cukup input */}
              </div>
            </div>

            {/* Peta kecil rute merchant → drop */}
            <div className="mt-3 rounded overflow-hidden border">
              <OSMMapView
                variant="streets"
                center={
                  merchant?.coords || dropCoords || { lat: -1.25, lng: 124.45 }
                }
                pickup={merchant?.coords || null}
                waypoints={[dropCoords]}
                drawRoute={Boolean(merchant?.coords && dropCoords)}
                onRouteComputed={(info) => setRouteInfo(info)}
                height={220}
              />
            </div>

            {/* ringkasan rute + ongkir */}
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-gray-700">
                  <Route className="w-4 h-4" />
                  Jarak
                </span>
                <span>{routeInfo?.distanceText || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-gray-700">
                  <Clock className="w-4 h-4" />
                  Waktu
                </span>
                <span>{routeInfo?.durationText || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Ongkir</span>
                <span className="font-semibold">
                  {deliveryFee != null ? formatIDR(deliveryFee) : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span>Total</span>
                <span className="text-base font-bold">
                  {formatIDR(itemsTotal + (deliveryFee ?? 0))}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <label className="label-xs">Catatan (opsional)</label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Contoh: minta plastik terpisah / sambal banyak"
              />
            </div>

            <button
              onClick={checkout}
              disabled={cart.length === 0 || !dropCoords}
              className="mt-4 w-full bg-emerald-600 text-white py-3 rounded-md hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Pesan & Cari Driver
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
