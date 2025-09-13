// src/app/customer/checkout/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SidebarCustomer from "@/components/SidebarCustomer";
import dynamic from "next/dynamic";
import { auth, db } from "@/lib/firebase";
import { updateDoc } from "firebase/firestore";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useCart } from "@/lib/cart";
import type { Timestamp } from "firebase/firestore";
import { formatIDR } from "@/lib/fare";

import { callMatch } from "@/lib/callMatch";

type LatLng = { lat: number; lng: number };

const OSMMapView = dynamic(() => import("@/components/OSMMapView"), {
  ssr: false,
});

type MerchantLite = {
  id: string;
  name?: string;
  address?: string;
  coords?: LatLng | null;
};

export default function CustomerCheckoutPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const merchantId = sp.get("merchant") || "";

  // keranjang per-merchant
  const { cart, subtotal, clear } = useCart(merchantId);

  const [merchant, setMerchant] = useState<MerchantLite | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [dropoffAddr, setDropoffAddr] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ambil info merchant untuk pickup
  useEffect(() => {
    if (!merchantId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "merchants", merchantId));
        if (snap.exists()) {
          const d = snap.data() as any;
          setMerchant({
            id: snap.id,
            name: d.name ?? "",
            address: d.address ?? "",
            coords: d.coords ?? null,
          });
        } else {
          setErr("Merchant tidak ditemukan.");
        }
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [merchantId]);

  const canPlace =
    cart.items.length > 0 && merchant?.coords && dropoff && !saving;

  async function placeOrder() {
    setErr(null);
    if (!auth.currentUser?.uid) {
      setErr("Anda belum login.");
      return;
    }
    if (!canPlace) return;

    setSaving(true);
    try {
      const customer = {
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName || null,
        email: auth.currentUser.email || null,
      };

      const payload = {
        service: "merchant", // sesuai Firestore Rules kamu
        status: "searching",
        vehicleType: "any",
        merchant: { id: merchant!.id, name: merchant!.name ?? null },
        customer,
        cart: {
          items: cart.items.map((it) => ({
            id: it.id,
            name: it.name,
            price: it.price,
            qty: it.qty,
          })),
          subtotal,
        },
        pickup: {
          address: merchant!.address ?? null,
          coords: merchant!.coords!,
        },
        destinations: [
          {
            address: dropoffAddr || "Tujuan",
            coords: dropoff!,
          },
        ],
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };

      const ref = await addDoc(collection(db, "orders"), payload);

      // Opsional: minta kandidat driver terdekat (suggest-only)
      // try {
      //   const j = await callMatch(ref.id, 15); // ← kirim token otomatis
      //   if (Array.isArray(j.candidates) && j.candidates.length) {
      //     const candidateUids = j.candidates.map((c) => c.uid);
      //     await updateDoc(ref, {
      //       candidateUids,
      //       candidates: j.candidates,
      //       candidatesUpdatedAt: serverTimestamp(),
      //       updatedAt: serverTimestamp(),
      //     });
      //   }
      // } catch (e) {
      //   console.warn("match-driver failed:", e);
      // }
      try {
        const user = auth.currentUser;
        const idToken = await user?.getIdToken(true);
        const r = await fetch("/api/match-driver", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`, // <- WAJIB
          },
          body: JSON.stringify({ orderId: ref.id, maxKm: 15 }),
        });
        const j = await r.json().catch(() => null);

        // SELALU tulis fields kandidat meski kosong → memudahkan debugging di Firestore
        if (j?.ok && Array.isArray(j.candidates)) {
          const candidateUids = j.candidates.map((c: any) => c.uid);
          try {
            await updateDoc(ref, {
              candidateUids,
              candidates: j.candidates, // meski []
              candidatesUpdatedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (e: any) {
            console.error("updateDoc candidates FAILED:", e);
          }
        } else {
          console.warn("match-driver returned not ok:", j);
        }
      } catch (e) {
        console.warn("match-driver failed:", e);
      }

      clear(); // kosongkan keranjang lokal
      router.replace(`/customer/order/${ref.id}`);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setSaving(false);
    }
  }

  const center: LatLng = dropoff ||
    merchant?.coords || { lat: -1.25, lng: 124.45 }; // fallback Bolsel

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />

      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="mb-3">
          <h1 className="text-2xl font-bold">Checkout</h1>
          <div className="text-sm text-gray-600">
            {merchant?.name ? `Dari: ${merchant.name}` : "-"}
          </div>
        </div>

        {/* Banner tambah produk lagi */}
        {merchantId && (
          <div className="mb-3 flex items-center justify-between rounded-lg border bg-white p-3 text-sm">
            <div>Mau tambah produk lagi dari merchant ini?</div>
            <a
              href={`/customer/merchants/${merchantId}?return=checkout`}
              className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50"
            >
              Tambah produk
            </a>
          </div>
        )}

        {err && (
          <div className="mb-3 text-[13px] px-3 py-2 rounded border border-red-300 bg-red-50 text-red-700">
            {err}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map & tujuan */}
          <section className="lg:col-span-2">
            <div className="bg-white rounded-xl border overflow-hidden">
              <OSMMapView
                variant="streets"
                center={center}
                pickup={merchant?.coords || null}
                waypoints={[dropoff]}
                drawRoute={Boolean(merchant?.coords && dropoff)}
                onMapClick={(c) => setDropoff(c)}
              />
            </div>

            <div className="mt-3 bg-white rounded-xl border p-3">
              <div className="text-sm font-semibold">Lokasi Pengantaran</div>
              <input
                type="text"
                value={dropoffAddr}
                onChange={(e) => setDropoffAddr(e.target.value)}
                placeholder="Catatan alamat / detail (opsional)"
                className="mt-2 w-full input-sm"
              />
              {dropoff ? (
                <div className="mt-1 text-[12px] text-gray-600">
                  Koordinat: {dropoff.lat.toFixed(5)}, {dropoff.lng.toFixed(5)}
                </div>
              ) : (
                <div className="mt-1 text-[12px] text-gray-600">
                  Klik pada peta untuk memilih lokasi pengantaran.
                </div>
              )}
            </div>
          </section>

          {/* Ringkasan keranjang */}
          <aside className="bg-white rounded-xl border p-4 h-max">
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
                  onClick={placeOrder}
                  disabled={!canPlace}
                  className={`mt-3 w-full px-3 py-2 rounded-md text-white text-sm ${
                    canPlace
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-gray-300"
                  }`}
                >
                  {saving ? "Memproses…" : "Buat Pesanan"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("product-list")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="mt-2 w-full px-3 py-2 rounded-md border text-sm hover:bg-gray-50"
                >
                  Lanjut belanja
                </button>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
