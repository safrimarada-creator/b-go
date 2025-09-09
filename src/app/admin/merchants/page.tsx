// src/app/admin/merchants/page.tsx
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
import type { Merchant } from "@/types/merchant";
import { Plus, Search, Edit3, Trash2, Store } from "lucide-react";

const initialForm: Merchant = {
  name: "",
  category: "",
  phone: "",
  address: "",
  photoUrl: "",
  isActive: true,
};

export default function AdminMerchantsPage() {
  const [rows, setRows] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Merchant>(initialForm);

  const [qText, setQText] = useState("");

  // live list
  useEffect(() => {
    setErr(null);
    const ref = collection(db, "merchants");
    const q = query(ref, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Merchant[] = [];
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
  }, []);

  const filtered = useMemo(() => {
    if (!qText) return rows;
    const v = qText.toLowerCase();
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(v) ||
        r.category?.toLowerCase().includes(v) ||
        r.phone?.toLowerCase().includes(v)
    );
  }, [rows, qText]);

  function openCreate() {
    setEditingId(null);
    setForm(initialForm);
    setOpenForm(true);
  }
  function openEdit(r: Merchant) {
    setEditingId(r.id || null);
    setForm({
      name: r.name ?? "",
      category: r.category ?? "",
      phone: r.phone ?? "",
      address: r.address ?? "",
      photoUrl: r.photoUrl ?? "",
      isActive: r.isActive ?? true,
    });
    setOpenForm(true);
  }

  async function save() {
    try {
      if (!form.name.trim()) throw new Error("Nama merchant wajib diisi.");

      if (editingId) {
        await updateDoc(doc(db, "merchants", editingId), {
          ...form,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "merchants"), {
          ...form,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setOpenForm(false);
      setEditingId(null);
      setForm(initialForm);
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function remove(id?: string) {
    if (!id) return;
    if (!confirm("Hapus merchant ini?")) return;
    try {
      await deleteDoc(doc(db, "merchants", id));
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Store className="w-6 h-6 text-emerald-600" />
          <span>Merchants</span>
        </h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Cari nama/kategori/telepon…"
            className="pl-8 pr-3 py-2 rounded-md border w-72 text-sm"
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
              <th className="px-4 py-2">Merchant</th>
              <th className="px-4 py-2">Kategori</th>
              <th className="px-4 py-2">Telepon</th>
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
              filtered.map((r) => (
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
                          {r.address || "-"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{r.category || "-"}</td>
                  <td className="px-4 py-3">{r.phone || "-"}</td>
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
              ))
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
          <div className="absolute inset-x-0 top-10 mx-auto w-[600px] max-w-[95vw] bg-white rounded-xl shadow-lg p-4">
            <h2 className="text-lg font-semibold mb-3">
              {editingId ? "Edit Merchant" : "Tambah Merchant"}
            </h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field
                label="Nama *"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              />
              <Field
                label="Kategori"
                value={form.category || ""}
                onChange={(v) => setForm((f) => ({ ...f, category: v }))}
              />
              <Field
                label="Telepon"
                value={form.phone || ""}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              />
              <Field
                label="Foto (URL)"
                value={form.photoUrl || ""}
                onChange={(v) => setForm((f) => ({ ...f, photoUrl: v }))}
              />
              <div className="sm:col-span-2">
                <Field
                  label="Alamat"
                  value={form.address || ""}
                  onChange={(v) => setForm((f) => ({ ...f, address: v }))}
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
