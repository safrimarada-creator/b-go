// src/app/admin/products/[id]/page.tsx
"use client";

// import SidebarAdmin from "@/components/SidebarAdmin";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Save, Trash2 } from "lucide-react";

export default function AdminProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdminUI =
    (session as any)?.user?.role === "admin" ||
    (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .includes((session?.user?.email || "").toLowerCase());

  const isNew = id === "new";

  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | string>(0);
  const [merchantId, setMerchantId] = useState<string>("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [photoUrl, setPhotoUrl] = useState("");

  const [merchantOptions, setMerchantOptions] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    getDocs(query(collection(db, "merchants"))).then((snap) => {
      setMerchantOptions(
        snap.docs.map((d) => ({
          id: d.id,
          name: (d.data() as any).name || d.id,
        }))
      );
    });
  }, []);

  useEffect(() => {
    if (isNew) return;
    const ref = doc(db, "products", id);
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        setName(d.name || "");
        setPrice(Number(d.price ?? 0));
        setMerchantId(d.merchantId || "");
        setIsAvailable(d.isAvailable !== false);
        setPhotoUrl(d.photoUrl || "");
      }
    });
  }, [id, isNew]);

  async function save() {
    if (!name.trim()) {
      alert("Nama wajib diisi");
      return;
    }
    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      alert("Harga tidak valid");
      return;
    }

    const ref = doc(db, "products", isNew ? crypto.randomUUID() : id);
    await setDoc(
      ref,
      {
        name: name.trim(),
        price: priceNum,
        merchantId: merchantId || null,
        isAvailable,
        photoUrl: photoUrl.trim() || null,
        updatedAt: serverTimestamp(),
        updatedBy: session?.user?.email || session?.user?.name || "admin",
      },
      { merge: true }
    );
    router.push("/admin/products");
  }

  async function remove() {
    if (isNew) return;
    if (!confirm("Hapus produk ini?")) return;
    await deleteDoc(doc(db, "products", id));
    router.push("/admin/products");
  }

  if (!isAdminUI) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold mb-2">Product</h1>
        <p className="text-gray-600">Akses ditolak.</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* <SidebarAdmin /> */}
      <main className="flex-1 p-6 md:ml-72 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">
          {isNew ? "Tambah Produk" : "Edit Produk"}
        </h1>

        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <Field label="Nama" value={name} onChange={setName} required />
          <Field
            label="Harga (Rp)"
            value={String(price)}
            onChange={(v) => setPrice(v)}
            type="number"
          />
          <label className="block">
            <div className="text-sm text-gray-600 mb-1">Merchant</div>
            <select
              className="w-full border rounded-md p-2"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
            >
              <option value="">—</option>
              {merchantOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
            />
            Tersedia
          </label>
          <Field label="Foto URL" value={photoUrl} onChange={setPhotoUrl} />

          <div className="flex gap-2">
            <button
              onClick={save}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white"
            >
              <Save className="w-4 h-4" /> Simpan
            </button>
            {!isNew && (
              <button
                onClick={remove}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-red-600"
              >
                <Trash2 className="w-4 h-4" /> Hapus
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">
        {label}
        {required && " *"}
      </div>
      <input
        className="w-full border rounded-md p-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
      />
    </label>
  );
}
