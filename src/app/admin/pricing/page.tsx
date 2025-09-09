"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
// import SidebarAdmin from "@/components/SidebarAdmin"; // sementara pakai ini
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  CircleDollarSign,
  Save,
  RefreshCw,
  Calculator,
  Info,
} from "lucide-react";
import { calculateFare, formatIDR } from "@/lib/fare";

type Pricing = {
  baseFare: number;
  perKm: number;
  perMin: number;
  bookingFee: number;
  minFare: number;
  roundTo: number;
  surgeMultiplier: number;
  vehicleMultipliers: { bike: number; car2: number; car3: number };
  updatedAt?: any;
  updatedBy?: string;
};

const PRICING_REF = doc(db, "configs", "pricing");
const DEFAULT_VM = { bike: 1, car2: 1.6, car3: 2.0 };

export default function AdminPricingPage() {
  const { data: session } = useSession();

  // (opsional) guard UI ringan
  const isAdminUI =
    (session?.user as any)?.role === "admin" ||
    (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .includes((session?.user?.email || "").toLowerCase());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [values, setValues] = useState<Pricing>({
    baseFare: 5000,
    perKm: 2500,
    perMin: 300,
    bookingFee: 1000,
    minFare: 8000,
    roundTo: 500,
    surgeMultiplier: 1,
    vehicleMultipliers: DEFAULT_VM,
  });

  const [testKm, setTestKm] = useState(5);
  const [testMin, setTestMin] = useState(15);
  const [testVehicle, setTestVehicle] = useState<"bike" | "car2" | "car3">(
    "bike"
  );

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(PRICING_REF);
        if (snap.exists()) {
          const d = snap.data() as any;
          setValues({
            baseFare: Number(d.baseFare ?? 5000),
            perKm: Number(d.perKm ?? 2500),
            perMin: Number(d.perMin ?? 300),
            bookingFee: Number(d.bookingFee ?? 1000),
            minFare: Number(d.minFare ?? 8000),
            roundTo: Number(d.roundTo ?? 500),
            surgeMultiplier: Number(d.surgeMultiplier ?? 1),
            vehicleMultipliers: {
              ...DEFAULT_VM,
              ...(d.vehicleMultipliers || {}),
            },
            updatedAt: d.updatedAt,
            updatedBy: d.updatedBy,
          });
        }
      } catch (e: any) {
        setErr(`Gagal memuat tarif: ${String(e?.message || e)}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function setNum<K extends keyof Pricing>(k: K, raw: string) {
    const n = Number(raw);
    setValues((v) => ({ ...v, [k]: isNaN(n) ? (v[k] as any) : (n as any) }));
  }

  function setVM(k: "bike" | "car2" | "car3", raw: string) {
    const n = Number(raw);
    setValues((v) => ({
      ...v,
      vehicleMultipliers: {
        ...v.vehicleMultipliers,
        [k]: isNaN(n) ? v.vehicleMultipliers[k] : n,
      },
    }));
  }

  async function handleSave() {
    if (!isAdminUI) {
      setErr("Akses ditolak. Halaman ini hanya untuk admin.");
      return;
    }
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const v = values;

      // validasi angka ≥ 0; multipliers > 0
      const nums = [
        v.baseFare,
        v.perKm,
        v.perMin,
        v.bookingFee,
        v.minFare,
        v.roundTo,
        v.surgeMultiplier,
        v.vehicleMultipliers.bike,
        v.vehicleMultipliers.car2,
        v.vehicleMultipliers.car3,
      ];
      if (nums.some((x) => typeof x !== "number" || isNaN(x) || x < 0)) {
        throw new Error("Pastikan semua nilai angka valid (≥ 0).");
      }
      if (
        v.vehicleMultipliers.bike <= 0 ||
        v.vehicleMultipliers.car2 <= 0 ||
        v.vehicleMultipliers.car3 <= 0
      ) {
        throw new Error("Multiplier harus > 0.");
      }

      await setDoc(
        PRICING_REF,
        {
          baseFare: v.baseFare,
          perKm: v.perKm,
          perMin: v.perMin,
          bookingFee: v.bookingFee,
          minFare: v.minFare,
          roundTo: v.roundTo,
          surgeMultiplier: v.surgeMultiplier,
          vehicleMultipliers: v.vehicleMultipliers,
          updatedAt: serverTimestamp(),
          updatedBy: session?.user?.email || session?.user?.name || "admin",
        },
        { merge: true }
      );
      setMsg("Tarif berhasil disimpan.");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  // hasil uji dengan multiplier
  const testResult = useMemo(() => {
    try {
      const f = values.vehicleMultipliers[testVehicle];
      const overrides = {
        ...values,
        baseFare: Math.round(values.baseFare * f),
        perKm: values.perKm * f,
        perMin: values.perMin * f,
        minFare: Math.round(values.minFare * f),
      };
      return calculateFare(testKm * 1000, testMin * 60, overrides);
    } catch {
      return null;
    }
  }, [testKm, testMin, values, testVehicle]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      {/* <SidebarAdmin /> */}
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        {!isAdminUI ? (
          <div className="bg-white border rounded-xl p-6">
            <h1 className="text-xl font-bold mb-2">Pengaturan Tarif</h1>
            <p className="text-gray-600">
              Akses ditolak. Halaman ini hanya untuk admin.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <CircleDollarSign className="w-6 h-6 text-green-600" />
                <span>Admin • Pengaturan Tarif</span>
              </h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setValues((v) => ({
                      ...v,
                      baseFare: 5000,
                      perKm: 2500,
                      perMin: 300,
                      bookingFee: 1000,
                      minFare: 8000,
                      roundTo: 500,
                      surgeMultiplier: 1,
                      vehicleMultipliers: DEFAULT_VM,
                    }))
                  }
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-white text-gray-700 hover:bg-gray-50 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Default
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                    saving
                      ? "bg-gray-300 text-gray-600"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="bg-white border rounded-lg p-4 text-sm text-gray-600">
                Memuat tarif…
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Form Tarif */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow p-4">
                  {msg && (
                    <div className="mb-3 text-[13px] px-3 py-2 rounded border border-emerald-300 bg-emerald-50 text-emerald-800">
                      {msg}
                    </div>
                  )}
                  {err && (
                    <div className="mb-3 text-[13px] px-3 py-2 rounded border border-red-300 bg-red-50 text-red-700">
                      {err}
                    </div>
                  )}

                  <h2 className="text-sm font-semibold mb-3">
                    Parameter Tarif
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FieldNumber
                      label="Base Fare (Rp)"
                      value={values.baseFare}
                      onChange={(v) => setNum("baseFare", v)}
                    />
                    <FieldNumber
                      label="Per Km (Rp)"
                      value={values.perKm}
                      onChange={(v) => setNum("perKm", v)}
                    />
                    <FieldNumber
                      label="Per Menit (Rp)"
                      value={values.perMin}
                      onChange={(v) => setNum("perMin", v)}
                    />
                    <FieldNumber
                      label="Booking Fee (Rp)"
                      value={values.bookingFee}
                      onChange={(v) => setNum("bookingFee", v)}
                    />
                    <FieldNumber
                      label="Minimal Bayar (Rp)"
                      value={values.minFare}
                      onChange={(v) => setNum("minFare", v)}
                    />
                    <FieldNumber
                      label="Pembulatan (roundTo)"
                      value={values.roundTo}
                      onChange={(v) => setNum("roundTo", v)}
                      hint="Contoh: 500 → pembulatan ke kelipatan Rp500"
                    />
                    <FieldNumber
                      label="Surge Multiplier (×)"
                      value={values.surgeMultiplier}
                      onChange={(v) => setNum("surgeMultiplier", v)}
                      step="0.1"
                      min="0.1"
                    />
                  </div>

                  <h2 className="text-sm font-semibold mt-6 mb-2">
                    Multiplier per Jenis Kendaraan
                  </h2>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <FieldNumber
                      label="Motor (×)"
                      value={values.vehicleMultipliers.bike}
                      onChange={(v) => setVM("bike", v)}
                      step="0.1"
                      min="0.1"
                    />
                    <FieldNumber
                      label="Mobil (2 kursi) (×)"
                      value={values.vehicleMultipliers.car2}
                      onChange={(v) => setVM("car2", v)}
                      step="0.1"
                      min="0.1"
                    />
                    <FieldNumber
                      label="Mobil (3 kursi) (×)"
                      value={values.vehicleMultipliers.car3}
                      onChange={(v) => setVM("car3", v)}
                      step="0.1"
                      min="0.1"
                    />
                  </div>

                  <div className="mt-4 text-[12px] text-gray-500">
                    {values.updatedAt && (
                      <>
                        Terakhir diperbarui:{" "}
                        <b>
                          {values.updatedAt?.toDate
                            ? values.updatedAt.toDate().toLocaleString("id-ID")
                            : ""}
                        </b>{" "}
                        {values.updatedBy ? (
                          <>
                            oleh <b>{values.updatedBy}</b>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>

                {/* Panel Uji Tarif */}
                <div className="bg-white rounded-xl shadow p-4 h-max">
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Uji Coba Estimasi
                  </h2>

                  <div className="grid grid-cols-2 gap-3">
                    <SmallNumber
                      label="Jarak (km)"
                      value={String(testKm)}
                      onChange={(v) => setTestKm(Number(v) || 0)}
                    />
                    <SmallNumber
                      label="Durasi (menit)"
                      value={String(testMin)}
                      onChange={(v) => setTestMin(Number(v) || 0)}
                    />
                  </div>

                  <div className="mt-3">
                    <label className="label-xs">Kendaraan</label>
                    <select
                      className="w-full input-sm"
                      value={testVehicle}
                      onChange={(e) => setTestVehicle(e.target.value as any)}
                    >
                      <option value="bike">Motor</option>
                      <option value="car2">Mobil (2 kursi)</option>
                      <option value="car3">Mobil (3 kursi)</option>
                    </select>
                  </div>

                  <div className="mt-3 text-[12px] text-gray-600 flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5" />
                    <span>Estimasi memakai multiplier kendaraan di atas.</span>
                  </div>

                  {testResult && (
                    <div className="mt-4 border rounded-lg p-3 text-sm space-y-1">
                      <div className="font-semibold">
                        Total: {formatIDR(testResult.total)}
                      </div>
                      <div>Dasar: {formatIDR(testResult.baseFare)}</div>
                      <div>
                        Jarak ({testResult.distanceKm.toFixed(2)} km):{" "}
                        {formatIDR(testResult.distanceFare)}
                      </div>
                      <div>
                        Waktu ({testResult.durationMin.toFixed(0)} mnt):{" "}
                        {formatIDR(testResult.timeFare)}
                      </div>
                      <div>Booking: {formatIDR(testResult.bookingFee)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  step = "1",
  min = "0",
  hint,
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
  step?: string;
  min?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="label-xs">{label}</label>
      <input
        type="number"
        step={step}
        min={min}
        value={value as any}
        onChange={(e) => onChange(e.target.value)}
        className="w-full input-sm"
      />
      {hint && <div className="mt-1 text-[11px] text-gray-500">{hint}</div>}
    </div>
  );
}

function SmallNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label-xs">{label}</label>
      <input
        type="number"
        step="0.1"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full input-sm"
      />
    </div>
  );
}
