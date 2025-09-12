"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import SidebarCustomer from "@/components/SidebarCustomer";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { useCart } from "@/lib/cart";
import { usePricing } from "@/lib/usePricing";
import { calculateFare, formatIDR } from "@/lib/fare";
import { osmReverseGeocode } from "@/lib/osm";
import type { Merchant } from "@/types/merchant";
import type { LatLng } from "@/types/merchant";

const OSMMapView = dynamic(() => import("@/components/OSMMapView"), {
  ssr: false,
});

export default function CheckoutClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const merchantId = sp.get("merchant") || "";

  const { cart, clear, subtotal } = useCart(merchantId);
  const {
    pricing,
    loading: pricingLoading,
    error: pricingError,
  } = usePricing();

  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [dropAddress, setDropAddress] = useState("");
  const [dropCoords, setDropCoords] = useState<LatLng | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distanceText: string;
    durationText: string;
    distanceValue: number;
    durationValue: number;
  } | null>(null);
  const [mErr, setMErr] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "merchants", merchantId));
        if (snap.exists()) {
          setMerchant({ id: snap.id, ...(snap.data() as any) });
        } else {
          setMErr("Merchant tidak ditemukan.");
        }
      } catch (err: any) {
        setMErr(String(err?.message || err));
      }
    })();
  }, [merchantId]);

  useEffect(() => {
    // prefill with current geolocation
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          const addr = await osmReverseGeocode(coords);
          setDropAddress(addr);
          setDropCoords(coords);
        } catch {
          setDropAddress(
            `(${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`
          );
          setDropCoords(coords);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 10_000 }
    );
  }, []);

  const deliveryFee = useMemo(() => {
    if (!pricing || !routeInfo) return null;
    const override = {
      ...pricing,
      baseFare: Math.round(
        pricing.baseFare * (pricing.vehicleMultipliers?.bike ?? 1)
      ),
      perKm: pricing.perKm * (pricing.vehicleMultipliers?.bike ?? 1),
      perMin: pricing.perMin * (pricing.vehicleMultipliers?.bike ?? 1),
      minFare: Math.round(
        pricing.minFare * (pricing.vehicleMultipliers?.bike ?? 1)
      ),
    };
    return calculateFare(
      routeInfo.distanceValue,
      routeInfo.durationValue,
      override
    );
  }, [pricing, routeInfo]);

  const grandTotal = useMemo(() => {
    const fee = deliveryFee?.total ?? 0;
    return subtotal + fee;
  }, [subtotal, deliveryFee]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.currentUser?.uid) {
      alert("Anda belum login.");
      return;
    }
    if (!merchant?.coords) {
      alert("Merchant tidak memiliki lokasi pickup.");
      return;
    }
    if (!dropCoords) {
      alert("Silakan pilih alamat pengantaran.");
      return;
    }
    if (!routeInfo || !deliveryFee) {
      alert("Rute atau ongkos kirim belum siap.");
      return;
    }
    const payload = {
      service: "merchant",
      status: "searching",
      createdAt: serverTimestamp(),
      pickup: {
        address: merchant.address || merchant.name || "Merchant",
        coords: merchant.coords,
      },
      destinations: [{ address: dropAddress, coords: dropCoords }],
      route: {
        distanceText: routeInfo.distanceText,
        durationText: routeInfo.durationText,
        distanceValue: routeInfo.distanceValue,
        durationValue: routeInfo.durationValue,
      },
      fare: {
        currency: "IDR",
        total: deliveryFee.total,
        baseFare: deliveryFee.baseFare,
        distanceFare: deliveryFee.distanceFare,
        timeFare: deliveryFee.timeFare,
        bookingFee: deliveryFee.bookingFee,
        surgeMultiplier: deliveryFee.surgeMultiplier,
      },
      items: cart.items.map((it) => ({
        id: it.id,
        name: it.name,
        price: it.price,
        qty: it.qty,
      })),
      subtotal,
      grandTotal,
      customer: {
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName || null,
        email: auth.currentUser.email || null,
      },
      driver: null,
    };

    const ref = await addDoc(collection(db, "orders"), payload);

    // call /api/match-driver to assign nearest driver (if needed)
    try {
      await fetch("/api/match-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: ref.id }),
      });
    } catch (err) {
      // not fatal
    }
    clear();
    router.push(`/customer/order/${ref.id}`);
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <h1 className="text-2xl font-bold">Checkout</h1>
        {mErr && <div className="text-red-600 text-sm">{mErr}</div>}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* ringkasan keranjang */}
          <div className="lg:col-span-2 bg-white border rounded-lg p-4">
            <h2 className="font-semibold mb-2">Ringkasan Pesanan</h2>
            {cart.items.map((it) => (
              <p key={it.id} className="flex justify-between text-sm">
                <span>
                  {it.name} × {it.qty}
                </span>
                <span>{formatIDR(it.price * it.qty)}</span>
              </p>
            ))}
            <hr className="my-2" />
            <p className="font-semibold text-sm flex justify-between">
              <span>Subtotal</span>
              <span>{formatIDR(subtotal)}</span>
            </p>
          </div>

          {/* panel lokasi & ongkir */}
          <div className="bg-white border rounded-lg p-4">
            <h2 className="font-semibold mb-2">Pengantaran</h2>
            <p className="text-sm">Alamat Pengantaran</p>
            <input
              className="w-full border rounded-md p-2 text-sm mt-1"
              value={dropAddress}
              onChange={(e) => setDropAddress(e.target.value)}
              placeholder="Cari alamat atau klik pada peta"
            />
            <div className="mt-3 border rounded h-56 overflow-hidden">
              <OSMMapView
                variant="streets"
                center={
                  dropCoords ?? merchant?.coords ?? { lat: -1.25, lng: 124.45 }
                }
                pickup={merchant?.coords || null}
                waypoints={[dropCoords]}
                onMapClick={(c) => {
                  osmReverseGeocode(c)
                    .then((addr) => {
                      setDropAddress(addr);
                      setDropCoords(c);
                    })
                    .catch(() => {
                      setDropAddress(
                        `(${c.lat.toFixed(5)}, ${c.lng.toFixed(5)})`
                      );
                      setDropCoords(c);
                    });
                }}
                drawRoute={Boolean(merchant?.coords && dropCoords)}
                onRouteComputed={(info) => setRouteInfo(info)}
              />
            </div>
            <div className="mt-3 text-sm">
              {routeInfo && deliveryFee ? (
                <>
                  Jarak {routeInfo.distanceText}, waktu {routeInfo.durationText}
                  <br />
                  Ongkir: <strong>{formatIDR(deliveryFee.total)}</strong>
                </>
              ) : (
                <span>Pilih alamat pengantaran untuk menghitung ongkir.</span>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={
                cart.items.length === 0 ||
                !merchant?.coords ||
                !dropCoords ||
                !deliveryFee
              }
              className={`w-full mt-4 py-2 rounded-md text-white text-sm ${
                cart.items.length === 0 || !dropCoords || !deliveryFee
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              Buat Pesanan
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
