// src/app/admin/layout.tsx
"use client";

import { useState } from "react";
import SidebarAdmin from "@/components/SidebarAdmin";
import { useFirebaseReady } from "@/lib/useFirebaseReady";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { ready, error } = useFirebaseReady("admin"); // biarkan seperti sebelumnya

  if (error)
    return (
      <div className="p-6 text-sm text-red-600">
        Gagal inisialisasi admin: {error}
      </div>
    );
  if (!ready)
    return (
      <div className="p-6 text-sm text-gray-600">Menyiapkan sesi admin…</div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <SidebarAdmin open={open} onClose={() => setOpen(false)} />

      {/* Konten di-offset oleh sidebar pada md+ */}
      <main className="md:ml-64 p-4 md:p-6">
        {/* Tombol buka menu untuk mobile */}
        <button
          className="md:hidden mb-3 inline-flex items-center gap-2 rounded border px-3 py-2 text-sm bg-white"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          Menu
        </button>

        {children}
      </main>
    </div>
  );
}
