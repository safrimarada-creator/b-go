"use client";
import { callMatch } from "@/lib/callMatch";
import SidebarCustomer from "@/components/SidebarCustomer";
import dynamic from "next/dynamic";
import AutocompleteInputOSM from "@/components/AutocompleteInputOSM";
import {
  MapPin,
  Navigation,
  MousePointerSquareDashed,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Bike,
  Route,
  Clock,
  Car,
  CircleDollarSign,
  Map as MapIcon,
  Image,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LatLng } from "@/lib/osm";
import { osmReverseGeocode } from "@/lib/osm";
import { calculateFare, formatIDR } from "@/lib/fare";
import { usePricing } from "@/lib/usePricing";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// Firestore (client SDK)
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

// Peta (Leaflet) client-side
const OSMMapView = dynamic(() => import("@/components/OSMMapView"), {
  ssr: false,
});

type SelectTarget = { kind: "pickup" } | { kind: "dest"; index: number } | null;
type VehicleType = "bike" | "car2" | "car3";

const DEFAULT_VM: Record<VehicleType, number> = {
  bike: 1,
  car2: 1.6,
  car3: 2.0,
};

export default function RidePage() {
  const router = useRouter();
  const { data: session } = useSession();

  // Kendaraan pilihan customer
  const [vehicleType, setVehicleType] = useState<VehicleType>("bike");

  // Pickup (alamat + koordinat)
  const [pickup, setPickup] = useState<string>("");
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);

  // Multi-tujuan (berurutan)
  const [destinations, setDestinations] = useState<
    { address: string; coords: LatLng | null }[]
  >([{ address: "", coords: null }]);

  // Mode pilih titik di peta
  const [selectTarget, setSelectTarget] = useState<SelectTarget>(null);

  // Info rute dari peta
  const [routeInfo, setRouteInfo] = useState<{
    distanceText: string;
    durationText: string;
    distanceValue: number;
    durationValue: number;
  } | null>(null);

  // Toggle gaya peta
  const [variant, setVariant] = useState<"streets" | "satellite">("streets");

  // Tarif dinamis (configs/pricing)
  const {
    pricing,
    loading: pricingLoading,
    error: pricingError,
    meta,
  } = usePricing();

  // Waypoints koordinat untuk peta
  const waypoints = useMemo(
    () => destinations.map((d) => d.coords),
    [destinations]
  );
  const canDrawRoute = Boolean(
    pickupCoords && waypoints.filter(Boolean).length > 0
  );

  // Estimasi tarif: terapkan multiplier per kendaraan
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
      // bookingFee, roundTo, surgeMultiplier tetap
    };

    return calculateFare(
      routeInfo.distanceValue,
      routeInfo.durationValue,
      overrides
    );
  }, [routeInfo, pricing, vehicleType]);

  // ===== Helpers =====

  // Isi alamat dari koordinat (reverse geocode)
  async function fillAddressFromCoords(coords: LatLng, target: SelectTarget) {
    try {
      const addr = await osmReverseGeocode(coords);
      if (!target) return;
      if (target.kind === "pickup") {
        setPickup(addr);
        setPickupCoords(coords);
      } else {
        setDestinations((prev) => {
          const next = [...prev];
          next[target.index] = { address: addr, coords };
          return next;
        });
      }
    } catch {
      const fallback = `(${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`;
      if (!target) return;
      if (target.kind === "pickup") {
        setPickup(fallback);
        setPickupCoords(coords);
      } else {
        setDestinations((prev) => {
          const next = [...prev];
          next[target.index] = { address: fallback, coords };
          return next;
        });
      }
    }
  }

  function addDestination() {
    setDestinations((prev) => [...prev, { address: "", coords: null }]);
  }
  function removeDestination(i: number) {
    setDestinations((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moveDestinationUp(i: number) {
    if (i === 0) return;
    setDestinations((prev) => {
      const arr = [...prev];
      [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
      return arr;
    });
  }
  function moveDestinationDown(i: number) {
    setDestinations((prev) => {
      if (i >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      return arr;
    });
  }

  // Auto-isi pickup dari GPS ketika halaman dibuka
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        await fillAddressFromCoords(coords, { kind: "pickup" });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 10_000 }
    );
  }, []);

  // 🟢 Submit → simpan order ke Firestore → redirect ke tracking
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // validasi dasar
    if (!pickupCoords) {
      alert("Silakan pilih titik penjemputan di peta / input.");
      return;
    }
    const filled = destinations.filter((d) => d.coords);
    if (filled.length === 0) {
      alert("Tambahkan minimal satu tujuan.");
      return;
    }
    if (!routeInfo || !fare) {
      alert("Rute/tarif belum siap. Coba ulangi setelah titik terpilih.");
      return;
    }

    // butuh auth uid agar lolos rules create
    const uid = auth.currentUser?.uid;
    if (!uid) {
      alert(
        "Sesi Firebase belum aktif di perangkat ini. Silakan reload atau login ulang."
      );
      return;
    }

    // data customer dari session (opsional)
    const customerName =
      session?.user?.name || auth.currentUser?.displayName || null;
    const customerEmail =
      session?.user?.email || auth.currentUser?.email || null;

    // snapshot tarif & kendaraan
    const pricingSnapshot = pricing || null;

    const payload = {
      service: "ride",
      vehicleType, // ⬅️ simpan tipe kendaraan
      status: "searching" as const, // searching → assigned → ...
      createdAt: serverTimestamp(),

      pricingSnapshot, // simpan snapshot tarif saat pemesanan
      fare: {
        currency: "IDR",
        total: fare.total,
        baseFare: fare.baseFare,
        distanceFare: fare.distanceFare,
        timeFare: fare.timeFare,
        bookingFee: fare.bookingFee,
        surgeMultiplier: fare.surgeMultiplier,
      },
      route: {
        distanceText: routeInfo.distanceText,
        durationText: routeInfo.durationText,
        distanceValue: routeInfo.distanceValue,
        durationValue: routeInfo.durationValue,
      },
      pickup: {
        address: pickup,
        coords: pickupCoords,
      },
      destinations: filled.map((d) => ({
        address: d.address,
        coords: d.coords,
      })),
      customer: {
        uid,
        name: customerName,
        email: customerEmail,
      },
      driver: null, // akan diisi saat ada driver assigned
    };

    const ref = await addDoc(collection(db, "orders"), payload);

    try {
      await callMatch(ref.id);
    } catch (e: any) {
      console.warn("match-driver failed:", e?.message || e);
    }

    router.push(`/customer/order/${ref.id}`);
  };

  // Kelas tombol ikon “pilih di peta”
  const pickBtnClass = (active: boolean, tone: "green" | "purple") =>
    [
      "btn-icon-sm",
      active
        ? tone === "green"
          ? "btn-active-green"
          : "btn-active-purple"
        : "",
    ].join(" ");

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarCustomer />

      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        {/* Header */}
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Bike className="w-6 h-6 text-green-600" />
          <span>Pesan Ojek (Multi-Tujuan)</span>
        </h1>
        <p className="text-gray-600 mb-3">
          Pilih jenis kendaraan, tambahkan beberapa tujuan, atur urutan, lalu
          pilih titik via pencarian atau klik di peta. Marker bisa di-drag.
        </p>

        {/* Pilih kendaraan */}
        <div className="mb-3 flex items-center gap-2">
          <Segment
            active={vehicleType === "bike"}
            onClick={() => setVehicleType("bike")}
            icon={<Bike className="w-4 h-4" />}
            label="Motor"
          />
          <Segment
            active={vehicleType === "car2"}
            onClick={() => setVehicleType("car2")}
            icon={<Car className="w-4 h-4" />}
            label="Mobil (2 kursi)"
          />
          <Segment
            active={vehicleType === "car3"}
            onClick={() => setVehicleType("car3")}
            icon={<Car className="w-4 h-4" />}
            label="Mobil (3 kursi)"
          />
        </div>

        {/* Toggle gaya peta */}
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            className={`btn-icon-sm ${
              variant === "streets" ? "btn-active-green" : ""
            }`}
            title="Peta Jalan (Streets)"
            onClick={() => setVariant("streets")}
          >
            <MapIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            className={`btn-icon-sm ${
              variant === "satellite" ? "btn-active-green" : ""
            }`}
            title="Peta Satelit"
            onClick={() => setVariant("satellite")}
          >
            <Image className="w-4 h-4" />
          </button>
        </div>

        {/* Banner mode pilih di peta */}
        {selectTarget && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2">
            <MousePointerSquareDashed className="w-5 h-5" />
            <span className="text-sm">
              Mode pilih titik{" "}
              <b>
                {selectTarget.kind === "pickup"
                  ? "Penjemputan"
                  : `Tujuan #${(selectTarget as any).index + 1}`}
              </b>
              : klik pada peta.
            </span>
            <button
              className="ml-auto text-xs underline"
              onClick={() => setSelectTarget(null)}
              type="button"
            >
              Selesai
            </button>
          </div>
        )}

        {/* Peta */}
        <div className="mb-4 rounded-xl overflow-hidden shadow-md">
          <OSMMapView
            variant={variant}
            center={pickupCoords || { lat: -1.25, lng: 124.45 }} // default Bolsel
            pickup={pickupCoords}
            waypoints={waypoints}
            onMapClick={(coords) => {
              if (!selectTarget) return;
              fillAddressFromCoords(coords, selectTarget);
              setSelectTarget(null);
            }}
            onPickupDrag={(coords) =>
              fillAddressFromCoords(coords, { kind: "pickup" })
            }
            onWaypointDrag={(index, coords) =>
              fillAddressFromCoords(coords, { kind: "dest", index })
            }
            drawRoute={canDrawRoute}
            onRouteComputed={(info) => setRouteInfo(info)}
          />
        </div>

        {/* Ringkasan rute + tarif */}
        <div className="mb-6 space-y-1">
          {pricingLoading && (
            <div className="text-[11px] text-gray-500">Memuat tarif…</div>
          )}
          {pricingError && (
            <div className="text-[11px] text-red-600">
              Gagal memuat tarif: {pricingError}
            </div>
          )}
          {meta?.updatedAt && (
            <div className="text-[11px] text-gray-400">
              Tarif diperbarui: {meta.updatedAt.toLocaleString("id-ID")}
              {meta.updatedBy ? ` oleh ${meta.updatedBy}` : ""}
            </div>
          )}

          {canDrawRoute && routeInfo ? (
            <div className="bg-white border rounded-lg px-4 py-3 shadow-sm space-y-2 inline-block">
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
                <div className="text-gray-800">
                  <div className="text-base font-semibold inline-flex items-center gap-2">
                    <CircleDollarSign className="w-5 h-5 text-green-600" />
                    Estimasi Tarif: {formatIDR(fare.total)}
                  </div>
                  <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                    <li>• Dasar: {formatIDR(fare.baseFare)}</li>
                    <li>
                      • Jarak ({fare.distanceKm.toFixed(2)} km):{" "}
                      {formatIDR(fare.distanceFare)}
                    </li>
                    <li>
                      • Waktu ({fare.durationMin.toFixed(0)} mnt):{" "}
                      {formatIDR(fare.timeFare)}
                    </li>
                    <li>• Booking: {formatIDR(fare.bookingFee)}</li>
                    <li>• Kendaraan: {vehicleType.toUpperCase()}</li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Pilih penjemputan & minimal satu tujuan untuk menghitung rute dan
              tarif…
            </div>
          )}
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 max-w-2xl bg-white p-4 rounded-xl shadow"
        >
          {/* Penjemputan */}
          <div>
            <label className="label-xs">Lokasi Penjemputan</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <AutocompleteInputOSM
                  value={pickup}
                  onChangeText={setPickup}
                  placeholder="Contoh: Jl. Merdeka No. 123"
                  icon={<MapPin className="w-4 h-4" />}
                  onPlaceSelected={({ address, lat, lng }) => {
                    setPickup(address);
                    setPickupCoords({ lat, lng });
                  }}
                />
              </div>

              {/* Ikon: pilih di peta (pickup) */}
              <button
                type="button"
                onClick={() => setSelectTarget({ kind: "pickup" })}
                className={pickBtnClass(
                  selectTarget?.kind === "pickup",
                  "green"
                )}
                title="Pilih titik penjemputan di peta"
                aria-label="Pilih titik penjemputan di peta"
              >
                <MapPin className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tujuan (dinamis) */}
          <div className="space-y-4">
            {destinations.map((d, i) => {
              const isActive =
                selectTarget?.kind === "dest" &&
                (selectTarget as any).index === i;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between">
                    <label className="label-xs">Tujuan #{i + 1}</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-icon-sm"
                        onClick={() => moveDestinationUp(i)}
                        title="Naikkan"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="btn-icon-sm"
                        onClick={() => moveDestinationDown(i)}
                        title="Turunkan"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      {destinations.length > 1 && (
                        <button
                          type="button"
                          className="btn-icon-sm text-red-600"
                          onClick={() => removeDestination(i)}
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1">
                      <AutocompleteInputOSM
                        value={d.address}
                        onChangeText={(v) =>
                          setDestinations((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i], address: v };
                            return next;
                          })
                        }
                        placeholder="Cari alamat / tempat"
                        icon={<Navigation className="w-4 h-4" />}
                        onPlaceSelected={({ address, lat, lng }) =>
                          setDestinations((prev) => {
                            const next = [...prev];
                            next[i] = { address, coords: { lat, lng } };
                            return next;
                          })
                        }
                      />
                    </div>

                    {/* Ikon: pilih di peta (dest i) */}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectTarget({ kind: "dest", index: i })
                      }
                      className={pickBtnClass(isActive, "purple")}
                      title={`Pilih titik tujuan #${i + 1} di peta`}
                      aria-label={`Pilih titik tujuan #${i + 1} di peta`}
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addDestination}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-white text-gray-700 hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" /> Tambah Tujuan
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 transition inline-flex items-center justify-center gap-2"
          >
            <Car className="w-5 h-5" />
            Cari Pengemudi
          </button>
        </form>
      </main>
    </div>
  );
}

/* ---------- Komponen kecil ---------- */

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
