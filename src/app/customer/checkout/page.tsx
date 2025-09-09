"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SidebarCustomer from "@/components/SidebarCustomer";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import type { Merchant } from "@/types/merchant";
import { useCart } from "@/lib/cart";
import dynamic from "next/dynamic";
import AutocompleteInputOSM from "@/components/AutocompleteInputOSM";
import { usePricing } from "@/lib/usePricing";
import { calculateFare, formatIDR } from "@/lib/fare";
import type { LatLng } from "@/types/merchant";
import { Route, Clock, MapPin, Bike } from "lucide-react";

const OSMMapView = dynamic(() => import("@/components/OSMMapView"), {
  ssr: false,
});

export default function CheckoutPage() {
  const params = useSearchParams();
  const merchantId = params.get("merchant") || "";
  const router = useRouter();
  const { cart, clear, subtotal } = useCart(merchantId);

  const [m, setM] = useState<Merchant | null>(null);
  const [destAddr, setDestAddr] = useState("");
  const [destCoords, setDestCoords] = useState<LatLng | null>(null);

  const [routeInfo, setRouteInfo] = useState<{
    distanceText: string;
    durationText: string;
    distanceValue: number;
    durationValue: number;
  } | null>(null);
  const { pricing } = usePricing();

  useEffect(() => {
    if (!merchantId) return;
    (async () => {
      const snap = await getDoc(doc(db, "merchants", merchantId));
      if (snap.exists()) setM({ id: snap.id, ...(snap.data() as any) });
    })();
  }, [merchantId]);

  const deliveryFare = useMemo(() => {
    if (!pricing || !routeInfo) return null;
    const mult = pricing.vehicleMultipliers?.bike ?? 1; // default kurir motor
    const overrides = {
      ...pricing,
      baseFare: Math.round(pricing.baseFare * mult),
      perKm: pricing.perKm * mult,
      perMin: pricing.perMin * mult,
      minFare: Math.round(pricing.minFare * mult),
    };
    return calculateFare(
      routeInfo.distanceValue,
      routeInfo.durationValue,
      overrides
    );
  }, [pricing, routeInfo]);

  async function placeOrder() {
    if (!m?.coords) return alert("Merchant belum punya koordinat.");
    if (!destCoords || !routeInfo || !deliveryFare)
      return alert("Lengkapi tujuan & rute.");

    const uid = auth.currentUser?.uid;
    if (!uid) return alert("Sesi Firebase tidak aktif.");

    const payload = {
      service: "merchant",
      status: "searching",
      createdAt: serverTimestamp(),
      customer: { uid },
      merchant: {
        id: m.id,
        name: m.name,
        coords: m.coords,
        address: m.address ?? null,
      },
      cart: cart.items.map((x) => ({
        id: x.id,
        name: x.name,
        price: x.price,
        qty: x.qty,
      })),
      totals: {
        items: subtotal,
        delivery: deliveryFare.total,
        grand: subtotal + deliveryFare.total,
      },
      pickup: { address: m.address ?? null, coords: m.coords },
      destinations: [{ address: destAddr, coords: destCoords }],
      route: routeInfo,
      pricingSnapshot: pricing ?? null,
      driver: null,
    };

    const ref = await addDoc(collection(db, "orders"), payload as any);
    clear();
    router.push(`/customer/order/${ref.id}`);
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <h1 className="text-2xl font-bold mb-4">Checkout</h1>

        {!m ? (
          <div className="bg-white border rounded-lg p-4">Memuat merchant…</div>
        ) : (
          <>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl border p-4">
                <div className="text-sm font-semibold mb-2">Alamat Tujuan</div>
                <AutocompleteInputOSM
                  value={destAddr}
                  onChangeText={setDestAddr}
                  placeholder="Masukkan alamat pengantaran"
                  icon={<MapPin className="w-4 h-4" />}
                  onPlaceSelected={({ address, lat, lng }) => {
                    setDestAddr(address);
                    setDestCoords({ lat, lng });
                  }}
                />

                <div className="mt-3 rounded overflow-hidden border">
                  <OSMMapView
                    variant="streets"
                    center={
                      destCoords || m.coords || { lat: -1.25, lng: 124.45 }
                    }
                    pickup={m.coords || null}
                    waypoints={[destCoords]}
                    drawRoute={Boolean(m.coords && destCoords)}
                    onWaypointDrag={(_, c) => setDestCoords(c)}
                    onRouteComputed={(info) => setRouteInfo(info)}
                    height={360}
                  />
                </div>

                {routeInfo && (
                  <div className="mt-3 text-sm text-gray-700 flex items-center gap-4">
                    <span className="inline-flex items-center gap-1">
                      <Route className="w-4 h-4" />
                      {routeInfo.distanceText}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {routeInfo.durationText}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Bike className="w-4 h-4" />
                      Kurir Motor
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border p-4 h-max">
                <div className="font-semibold mb-2">Ringkasan</div>
                <div className="text-sm">Barang: {formatIDR(subtotal)}</div>
                <div className="text-sm">
                  Ongkir: {deliveryFare ? formatIDR(deliveryFare.total) : "-"}
                </div>
                <div className="text-sm font-semibold mt-1">
                  Total:{" "}
                  {deliveryFare
                    ? formatIDR(subtotal + deliveryFare.total)
                    : "-"}
                </div>
                <button
                  onClick={placeOrder}
                  className="mt-3 w-full px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                >
                  Buat Pesanan
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
