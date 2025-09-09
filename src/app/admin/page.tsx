"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import SidebarAdmin from "@/components/SidebarAdmin";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import {
  LayoutGrid,
  CircleDollarSign,
  Users,
  Activity,
  ArrowRight,
  Clock,
  Route,
  User,
} from "lucide-react";
import { formatIDR } from "@/lib/fare";

type OrderDoc = {
  status: string;
  customer?: { name?: string; email?: string };
  createdAt?: Timestamp;
  fare?: { total?: number };
};

export default function AdminDashboardPage() {
  const { data: session } = useSession();

  // ===== Guard UI sisi client (opsional, proteksi utama via middleware/rules) =====
  const isAdminUI = useMemo(() => {
    const list =
      process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) ?? [];
    const email = session?.user?.email?.toLowerCase() ?? "";
    return list.includes(email);
  }, [session?.user?.email]);

  // ===== State ringkasan =====
  const [searchingCount, setSearchingCount] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [driversOnline, setDriversOnline] = useState<number>(0);
  const [recent, setRecent] = useState<Array<{ id: string; data: OrderDoc }>>(
    []
  );
  const [err, setErr] = useState<string | null>(null);

  // ===== Realtime listener Firestore =====
  useEffect(() => {
    setErr(null);
    const unsub: Array<() => void> = [];

    try {
      // 1) Order status = "searching"
      {
        const q1 = query(
          collection(db, "orders"),
          where("status", "==", "searching")
        );
        unsub.push(onSnapshot(q1, (snap) => setSearchingCount(snap.size)));
      }

      // 2) Order aktif (assigned/driver_arriving/ongoing)
      {
        const activeStatuses = ["assigned", "driver_arriving", "ongoing"];
        const q2 = query(
          collection(db, "orders"),
          where("status", "in", activeStatuses)
        );
        unsub.push(onSnapshot(q2, (snap) => setActiveCount(snap.size)));
      }

      // 3) Driver online (driverLocations.online == true)
      {
        const q3 = query(
          collection(db, "driverLocations"),
          where("online", "==", true)
        );
        unsub.push(onSnapshot(q3, (snap) => setDriversOnline(snap.size)));
      }

      // 4) 5 order terbaru
      {
        const q4 = query(
          collection(db, "orders"),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        unsub.push(
          onSnapshot(q4, (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              data: d.data() as OrderDoc,
            }));
            setRecent(list);
          })
        );
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    }

    return () => unsub.forEach((fn) => fn());
  }, []);

  if (!isAdminUI) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
        <SidebarAdmin />
        <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
          <h1 className="text-xl font-semibold mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">
            Akses ditolak. Halaman ini hanya untuk admin.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <SidebarAdmin />

      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-emerald-600" />
            <span>Admin • Dashboard</span>
          </h1>

          <Link
            href="/admin/pricing"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
          >
            <CircleDollarSign className="w-4 h-4" />
            Kelola Tarif
          </Link>
        </div>

        {err && (
          <div className="mb-4 text-[13px] px-3 py-2 rounded border border-red-300 bg-red-50 text-red-700">
            {err}
          </div>
        )}

        {/* Kartu ringkasan */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<Activity className="w-5 h-5" />}
            title="Order Searching"
            value={searchingCount}
            hint="Menunggu driver ambil"
          />
          <SummaryCard
            icon={<Route className="w-5 h-5" />}
            title="Order Aktif"
            value={activeCount}
            hint="Sedang berjalan"
          />
          <SummaryCard
            icon={<Users className="w-5 h-5" />}
            title="Driver Online"
            value={driversOnline}
            hint="Tersedia menerima order"
          />
        </div>

        {/* Order terbaru */}
        <section className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Order Terbaru</h2>
            <Link
              href="/admin/orders"
              className="text-sm inline-flex items-center gap-1 text-emerald-700 hover:underline"
            >
              Lihat semua <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="text-sm text-gray-500">Belum ada data order.</div>
          ) : (
            <ul className="divide-y">
              {recent.map(({ id, data }) => {
                const created = data.createdAt?.toDate
                  ? (data.createdAt.toDate() as Date)
                  : undefined;
                return (
                  <li key={id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          #{id.slice(0, 6).toUpperCase()}
                        </span>
                        <StatusBadge status={data.status} />
                      </div>
                      <div className="text-[12px] text-gray-600 mt-0.5 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {data.customer?.name ||
                            data.customer?.email ||
                            "Customer"}
                        </span>
                        {typeof data.fare?.total === "number" && (
                          <span className="inline-flex items-center gap-1">
                            <CircleDollarSign className="w-3.5 h-3.5" />
                            {formatIDR(data.fare!.total!)}
                          </span>
                        )}
                        {created && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {created.toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/admin/orders/${id}`}
                      className="text-xs px-2.5 py-1.5 rounded-md border hover:bg-gray-50 whitespace-nowrap"
                    >
                      Detail
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

/* ========== sub-komponen ========== */
function SummaryCard({
  icon,
  title,
  value,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700">
          {icon}
        </div>
        <div>
          <div className="text-sm text-gray-600">{title}</div>
          <div className="text-xl font-semibold leading-tight">{value}</div>
          {hint && <div className="text-[11px] text-gray-500">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const cls =
    status === "searching"
      ? "bg-amber-100 text-amber-800"
      : status === "assigned" || status === "driver_arriving"
      ? "bg-blue-100 text-blue-800"
      : status === "ongoing"
      ? "bg-emerald-100 text-emerald-800"
      : status === "completed"
      ? "bg-gray-100 text-gray-700"
      : "bg-slate-100 text-slate-700";
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded ${cls}`}>
      {status ?? "unknown"}
    </span>
  );
}
