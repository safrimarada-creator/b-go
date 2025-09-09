"use client";

import SidebarCustomer from "@/components/SidebarCustomer";
import dynamic from "next/dynamic";
import AutocompleteInputOSM from "@/components/AutocompleteInputOSM";
import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Navigation,
  CircleDollarSign,
  Route,
  Clock,
  Bike,
  Car,
  Image,
  Map as MapIcon,
} from "lucide-react";
import type { LatLng } from "@/lib/osm";
import { osmReverseGeocode } from "@/lib/osm";
import { calculateFare, formatIDR } from "@/lib/fare";
import { usePricingDelivery } from "@/lib/usePricingDelivery";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const OSMMapView = dynamic(() => import("@/components/OSMMapView"), {
  ssr: false,
});
type VehicleType = "bike" | "car2" | "car3";

const DEFAULT_VM: Record<VehicleType, number> = {
  bike: 1,
  car2: 1.6,
  car3: 2.0,
};

export default function DeliveryPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [variant, setVariant] = useState<"streets" | "satellite">("streets");

  const [vehicleType, setVehicleType] = useState<VehicleType>("bike");

  const [pickup, setPickup] = useState<string>("");
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);

  const [drop, setDrop] = useState<string>("");
  const [dropCoords, setDropCoords] = useState<LatLng | null>(null);

  const [routeInfo, setRouteInfo] = useState<{
    distanceText: string;
    durationText: string;
    distanceValue: number;
    durationValue: number;
  } | null>(null);

  const {
    pricing,
    loading: loadingPricing,
    error: errorPricing,
    meta,
  } = usePricingDelivery();

  async function fill(addrCoords: LatLng, target: "pickup" | "drop") {
    try {
      const addr = await osmReverseGeocode(addrCoords);
      if (target === "pickup") {
        setPickup(addr);
        setPickupCoords(addrCoords);
      } else {
        setDrop(addr);
        setDropCoords(addrCoords);
      }
    } catch {
      const fallback = `(${addrCoords.lat.toFixed(5)}, ${addrCoords.lng.toFixed(
        5
      )})`;
      if (target === "pickup") {
        setPickup(fallback);
        setPickupCoords(addrCoords);
      } else {
        setDrop(fallback);
        setDropCoords(addrCoords);
      }
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        await fill(c, "pickup");
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 10_000 }
    );
  }, []);

  const canDrawRoute = Boolean(pickupCoords && dropCoords);
  const waypoints = useMemo<(LatLng | null)[]>(
    () => (dropCoords ? [dropCoords] : []),
    [dropCoords]
  );

  // Estimasi tarif: pakai pricing_delivery + multiplier kendaraan
  const fare = useMemo(() => {
    if (!routeInfo || !pricing) return null;
    const mult =
      pricing.vehicleMultipliers?.[vehicleType] ?? DEFAULT_VM[vehicleType];
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
  }, [routeInfo, pricing, vehicleType]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pickupCoords || !dropCoords) {
      alert("Pilih pickup & dropoff terlebih dahulu.");
      return;
    }
    if (!routeInfo || !fare) {
      alert("Rute/tarif belum siap.");
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) {
      alert("Firebase Auth belum aktif di perangkat ini.");
      return;
    }

    const payload = {
      service: "delivery" as const,
      vehicleType,
      status: "searching" as const,
      createdAt: serverTimestamp(),
      pricingSnapshot: pricing || null,
      route: {
        distanceText: routeInfo.distanceText,
        durationText: routeInfo.durationText,
        distanceValue: routeInfo.distanceValue,
        durationValue: routeInfo.durationValue,
      },
      fare: {
        currency: "IDR",
        total: fare.total,
        baseFare: fare.baseFare,
        distanceFare: fare.distanceFare,
        timeFare: fare.timeFare,
        bookingFee: fare.bookingFee,
        surgeMultiplier: fare.surgeMultiplier,
      },
      pickup: { address: pickup, coords: pickupCoords },
      dropoff: { address: drop, coords: dropCoords },
      customer: {
        uid,
        name: session?.user?.name || null,
        email: session?.user?.email || null,
      },
      driver: null,
    };

    const ref = await addDoc(collection(db, "orders"), payload);
    router.push(`/customer/order/${ref.id}`);
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Bike className="w-6 h-6 text-green-600" />
          <span>Antar Barang</span>
        </h1>

        {/* Pilih kendaraan */}
        <div className="mb-3 flex items-center gap-2">
          <Segment
            label="Motor"
            active={vehicleType === "bike"}
            onClick={() => setVehicleType("bike")}
            icon={<Bike className="w-4 h-4" />}
          />
          <Segment
            label="Mobil (2 kursi)"
            active={vehicleType === "car2"}
            onClick={() => setVehicleType("car2")}
            icon={<Car className="w-4 h-4" />}
          />
          <Segment
            label="Mobil (3 kursi)"
            active={vehicleType === "car3"}
            onClick={() => setVehicleType("car3")}
            icon={<Car className="w-4 h-4" />}
          />
        </div>

        {/* Toggle peta */}
        <div className="mb-3 flex items-center gap-2">
          <button
            className={`btn-icon-sm ${
              variant === "streets" ? "btn-active-green" : ""
            }`}
            onClick={() => setVariant("streets")}
            title="Peta Jalan"
          >
            <MapIcon className="w-4 h-4" />
          </button>
          <button
            className={`btn-icon-sm ${
              variant === "satellite" ? "btn-active-green" : ""
            }`}
            onClick={() => setVariant("satellite")}
            title="Satelit"
          >
            <Image className="w-4 h-4" />
          </button>
        </div>

        {/* Peta */}
        <div className="mb-4 rounded-xl overflow-hidden shadow-md">
          <OSMMapView
            variant={variant}
            center={pickupCoords || { lat: -1.25, lng: 124.45 }}
            pickup={pickupCoords}
            waypoints={waypoints}
            drawRoute={canDrawRoute}
            onRouteComputed={(info) => setRouteInfo(info)}
            onPickupDrag={(c) => fill(c, "pickup")}
            onWaypointDrag={(_, c) => fill(c, "drop")}
            onMapClick={(c) => {
              // klik pertama set pickup, kedua set drop
              if (!pickupCoords) fill(c, "pickup");
              else fill(c, "drop");
            }}
          />
        </div>

        {/* Form alamat */}
        <form
          onSubmit={submit}
          className="space-y-4 max-w-2xl bg-white p-4 rounded-xl shadow"
        >
          <div>
            <label className="label-xs">Pickup</label>
            <AutocompleteInputOSM
              value={pickup}
              onChangeText={setPickup}
              icon={<MapPin className="w-4 h-4" />}
              placeholder="Alamat pengambilan"
              onPlaceSelected={({ address, lat, lng }) => {
                setPickup(address);
                setPickupCoords({ lat, lng });
              }}
            />
          </div>
          <div>
            <label className="label-xs">Dropoff</label>
            <AutocompleteInputOSM
              value={drop}
              onChangeText={setDrop}
              icon={<Navigation className="w-4 h-4" />}
              placeholder="Alamat tujuan"
              onPlaceSelected={({ address, lat, lng }) => {
                setDrop(address);
                setDropCoords({ lat, lng });
              }}
            />
          </div>

          {/* Ringkasan */}
          <div className="space-y-1">
            {loadingPricing && (
              <div className="text-[11px] text-gray-500">Memuat tarif…</div>
            )}
            {errorPricing && (
              <div className="text-[11px] text-red-600">
                Gagal memuat tarif: {errorPricing}
              </div>
            )}
            {meta?.updatedAt && (
              <div className="text-[11px] text-gray-400">
                Tarif diperbarui: {meta.updatedAt.toLocaleString("id-ID")}{" "}
                {meta.updatedBy ? `oleh ${meta.updatedBy}` : ""}
              </div>
            )}

            {canDrawRoute && routeInfo ? (
              <div className="bg-white border rounded-lg px-4 py-3 shadow-sm inline-block">
                <div className="text-sm text-gray-700 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Route className="w-4 h-4" />
                    <b>Jarak:</b> {routeInfo.distanceText}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <b>Waktu:</b> {routeInfo.durationText}
                  </span>
                </div>
                {fare && (
                  <div className="text-gray-800 mt-1">
                    <div className="text-base font-semibold inline-flex items-center gap-2">
                      <CircleDollarSign className="w-5 h-5 text-green-600" />
                      Estimasi Tarif: {formatIDR(fare.total)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Pilih pickup & dropoff untuk menghitung tarif…
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 transition inline-flex items-center justify-center gap-2"
          >
            <Car className="w-5 h-5" />
            Cari Kurir
          </button>
        </form>
      </main>
    </div>
  );
}

function Segment({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
        active
          ? "bg-emerald-600 text-white border-emerald-600"
          : "bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
