// src/app/admin/products/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Product } from "@/types/product";
import type { Merchant } from "@/types/merchant";
import { Package, Plus, Edit3, Trash2, Search, Store } from "lucide-react";

const initProduct: Product = {
  merchantId: "",
  name: "",
  price: 0,
  unit: "pcs",
  photoUrl: "",
  description: "",
  isActive: true,
};

export default function AdminProductsPage() {
  // merchants (untuk filter & form select)
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [mLoading, setMLoading] = useState(true);

  // products
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // filter
  const [merchantFilter, setMerchantFilter] = useState<string>("all");
  const [qText, setQText] = useState("");

  // form
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Product>(initProduct);

  // load merchants
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "merchants"), orderBy("name", "asc")),
      (snap) => {
        const arr: Merchant[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setMerchants(arr);
        setMLoading(false);
      },
      () => setMLoading(false)
    );
    return () => unsub();
  }, []);

  // load products (reactive to merchantFilter)
  useEffect(() => {
    setErr(null);
    setLoading(true);
    const ref = collection(db, "products");
    const q =
      merchantFilter === "all"
        ? query(ref, orderBy("createdAt", "desc"))
        : query(
            ref,
            where("merchantId", "==", merchantFilter),
            orderBy("createdAt", "desc")
          );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Product[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setRows(arr);
        setLoading(false);
      },
      (e) => {
        setErr(String(e?.message || e));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [merchantFilter]);

  const filtered = useMemo(() => {
    if (!qText) return rows;
    const v = qText.toLowerCase();
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(v) ||
        r.unit?.toLowerCase().includes(v) ||
        String(r.price).includes(v)
    );
  }, [rows, qText]);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...initProduct,
      merchantId: merchantFilter === "all" ? "" : merchantFilter,
    });
    setOpenForm(true);
  }
  function openEdit(r: Product) {
    setEditingId(r.id || null);
    setForm({
      merchantId: r.merchantId,
      name: r.name,
      price: r.price,
      unit: r.unit || "",
      description: r.description || "",
      photoUrl: r.photoUrl || "",
      isActive: r.isActive ?? true,
    });
    setOpenForm(true);
  }

  async function save() {
    try {
      if (!form.merchantId) throw new Error("Pilih merchant.");
      if (!form.name.trim()) throw new Error("Nama produk wajib diisi.");
      const priceNum = Number(form.price);
      if (isNaN(priceNum) || priceNum < 0)
        throw new Error("Harga tidak valid.");

      if (editingId) {
        await updateDoc(doc(db, "products", editingId), {
          ...form,
          price: priceNum,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "products"), {
          ...form,
          price: priceNum,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setOpenForm(false);
      setEditingId(null);
      setForm(initProduct);
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function remove(id?: string) {
    if (!id) return;
    if (!confirm("Hapus produk ini?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-emerald-600" />
          <span>Products</span>
        </h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-gray-500" />
          <select
            className="border rounded-md px-2 py-2 text-sm"
            value={merchantFilter}
            onChange={(e) => setMerchantFilter(e.target.value)}
          >
            <option value="all">Semua merchant</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Cari nama/harga…"
            className="pl-8 pr-3 py-2 rounded-md border w-64 text-sm"
          />
        </div>
      </div>

      {err && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 p-2 rounded">
          {err}
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Produk</th>
              <th className="px-4 py-2">Merchant</th>
              <th className="px-4 py-2">Harga</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 w-40">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-gray-500">
                  Memuat…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-gray-500">
                  Belum ada data.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const m = merchants.find((x) => x.id === r.merchantId);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {r.photoUrl ? (
                          <img
                            src={r.photoUrl}
                            className="w-10 h-10 rounded object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100" />
                        )}
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-[11px] text-gray-500 truncate max-w-[28rem]">
                            {r.description || "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{m?.name || "-"}</td>
                    <td className="px-4 py-3">
                      Rp {Number(r.price || 0).toLocaleString("id-ID")}
                      {r.unit ? ` / ${r.unit}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      {r.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          className="px-3 py-1 rounded border text-gray-700 hover:bg-gray-50"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => remove(r.id)}
                          className="px-3 py-1 rounded border text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {openForm && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpenForm(false)}
          />
          <div className="absolute inset-x-0 top-10 mx-auto w-[700px] max-w-[95vw] bg-white rounded-xl shadow-lg p-4">
            <h2 className="text-lg font-semibold mb-3">
              {editingId ? "Edit Produk" : "Tambah Produk"}
            </h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label-xs">Merchant *</label>
                <select
                  className="input-sm w-full"
                  value={form.merchantId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, merchantId: e.target.value }))
                  }
                >
                  <option value="">— Pilih Merchant —</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <Field
                label="Nama Produk *"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              />
              <Field
                label="Harga (Rp) *"
                type="number"
                value={String(form.price)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, price: Number(v) || 0 }))
                }
              />

              <Field
                label="Satuan"
                value={form.unit || ""}
                onChange={(v) => setForm((f) => ({ ...f, unit: v }))}
              />
              <Field
                label="Foto (URL)"
                value={form.photoUrl || ""}
                onChange={(v) => setForm((f) => ({ ...f, photoUrl: v }))}
              />

              <div className="sm:col-span-2">
                <label className="label-xs">Deskripsi</label>
                <textarea
                  rows={3}
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label-xs">Status</label>
                <select
                  className="input-sm w-full"
                  value={form.isActive ? "1" : "0"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.value === "1" }))
                  }
                >
                  <option value="1">Aktif</option>
                  <option value="0">Nonaktif</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setOpenForm(false)}
                className="px-3 py-2 rounded-md border bg-white text-gray-700 hover:bg-gray-50 text-sm"
              >
                Batal
              </button>
              <button
                onClick={save}
                className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="label-xs">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-sm w-full"
      />
    </div>
  );
}
