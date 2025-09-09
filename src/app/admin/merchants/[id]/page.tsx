"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import SidebarAdmin from "@/components/SidebarAdmin";
import ImageUploader from "@/components/ImageUploader";

import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import AutocompleteInputOSM from "@/components/AutocompleteInputOSM";
import { osmReverseGeocode } from "@/lib/osm"; // ⬅️ untuk auto isi alamat
import type { Merchant, LatLng } from "@/types/merchant";

import {
  Save,
  MapPin,
  Image as ImageIcon,
  Phone,
  Tag,
  Check,
} from "lucide-react";

const OSMMapView = dynamic(() => import("@/components/OSMMapView"), {
  ssr: false,
});

export default function AdminMerchantEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [phoneVal, setPhoneVal] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [serviceRadiusKm, setRadiusKm] = useState<number>(5);

  // Load data saat edit
  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const ref = doc(db, "merchants", id!);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setErr("Merchant tidak ditemukan.");
          return;
        }
        const d = snap.data() as Merchant;
        setName(d.name || "");
        setCategory(d.category || "");
        setAddress(d.address || "");
        setCoords(d.coords ?? null);
        setPhotoUrl(d.photoUrl || "");
        setPhoneVal(d.phone || "");
        setIsActive(d.isActive ?? true);
        setRadiusKm(d.serviceRadiusKm ?? 5);
      } catch (e: any) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  // Helper: trim → null ketimbang undefined
  const nn = (v: string) => (v.trim() ? v.trim() : null);

  // Auto-isi alamat saat klik peta/drag marker
  async function setCoordsAndMaybeAddress(c: LatLng) {
    setCoords(c);
    try {
      const addr = await osmReverseGeocode(c);
      setAddress(addr);
    } catch {
      // fallback ke (lat, lng) agar tidak undefined
      setAddress(`(${c.lat.toFixed(5)}, ${c.lng.toFixed(5)})`);
    }
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      if (!name.trim()) throw new Error("Nama merchant wajib diisi.");

      const payload: Merchant = {
        name: name.trim(),
        category: nn(category),
        address: nn(address), // ⬅️ null kalau kosong
        coords: coords ? { lat: coords.lat, lng: coords.lng } : null,
        photoUrl: nn(photoUrl),
        phone: nn(phoneVal),
        isActive,
        serviceRadiusKm:
          typeof serviceRadiusKm === "number" && !isNaN(serviceRadiusKm)
            ? serviceRadiusKm
            : null,
        updatedAt: serverTimestamp() as any,
      };

      if (isNew) {
        await addDoc(collection(db, "merchants"), {
          ...payload,
          createdAt: serverTimestamp(),
        } as any);
        setMsg("Merchant dibuat.");
        // Kembali ke list atau tetap di halaman? Bebas.
        router.replace("/admin/merchants");
      } else {
        await setDoc(doc(db, "merchants", id!), payload as any, {
          merge: true,
        });
        setMsg("Merchant disimpan.");
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarAdmin />
      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {isNew ? "Tambah Merchant" : "Edit Merchant"}
          </h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
              saving
                ? "bg-gray-300 text-gray-600"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            <Save className="w-4 h-4" />
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>

        {loading ? (
          <div className="bg-white border rounded-lg p-4">Memuat…</div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Form kiri */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow p-4 space-y-4">
              {msg && (
                <div className="text-xs px-3 py-2 rounded border border-emerald-300 bg-emerald-50 text-emerald-800">
                  {msg}
                </div>
              )}
              {err && (
                <div className="text-xs px-3 py-2 rounded border border-red-300 bg-red-50 text-red-700">
                  {err}
                </div>
              )}

              <div>
                <label className="label-xs">Nama</label>
                <input
                  className="input-sm w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Toko Sembako Jaya"
                />
              </div>

              <div>
                <label className="label-xs flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Kategori
                </label>
                <input
                  className="input-sm w-full"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="contoh: grocery / food / laundry"
                />
              </div>

              <div>
                <label className="label-xs">Alamat</label>
                <AutocompleteInputOSM
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Cari alamat…"
                  icon={<MapPin className="w-4 h-4" />}
                  onPlaceSelected={({ address, lat, lng }) => {
                    setAddress(address);
                    setCoords({ lat, lng });
                  }}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-xs">Koordinat</label>
                  <div className="text-xs text-gray-700">
                    {coords
                      ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                      : "Belum dipilih"}
                  </div>
                </div>
                <div>
                  <label className="label-xs">Radius Layanan (km)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    className="input-sm w-full"
                    value={String(serviceRadiusKm)}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <ImageUploader
                  value={photoUrl || null}
                  onChange={(url) => setPhotoUrl(url || "")}
                  pathPrefix={`merchants/${id && id !== "new" ? id : "tmp"}`}
                />
              </div>

              <div>
                <label className="label-xs flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Telepon
                </label>
                <input
                  className="input-sm w-full"
                  value={phoneVal}
                  onChange={(e) => setPhoneVal(e.target.value)}
                  placeholder="08xxxx"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="inline-flex items-center gap-1">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Aktif
                </span>
              </label>
            </div>

            {/* Peta kanan */}
            <div className="bg-white rounded-xl shadow p-3">
              <div className="text-sm font-semibold mb-2">Pilih di Peta</div>
              <div className="rounded overflow-hidden border">
                <OSMMapView
                  variant="streets"
                  center={coords || { lat: -1.25, lng: 124.45 }}
                  pickup={coords}
                  waypoints={[]}
                  drawRoute={false}
                  // ⬇️ klik peta atau drag marker → set coords + isi alamat
                  onMapClick={(c) => setCoordsAndMaybeAddress(c)}
                  onPickupDrag={(c) => setCoordsAndMaybeAddress(c)}
                  height={360}
                />
              </div>
              <div className="text-[11px] text-gray-500 mt-2">
                Klik peta atau drag marker untuk menetapkan koordinat merchant.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
