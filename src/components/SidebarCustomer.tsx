"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Menu,
  X,
  Home,
  Bike,
  ShoppingBag,
  WashingMachine,
  Package,
  ClipboardList,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";

export default function SidebarCustomer() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Lock scroll body saat drawer terbuka (mobile)
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const nav = useMemo(
    () => [
      { href: "/customer", label: "Dashboard", icon: Home },
      { href: "/customer/ride", label: "Ojek / Ride", icon: Bike },
      {
        href: "/customer/products",
        label: "Belanja Produk",
        icon: ShoppingBag,
      },
      { href: "/customer/laundry", label: "Laundry", icon: WashingMachine },
      { href: "/customer/delivery", label: "Kirim Barang", icon: Package },
      { href: "/customer/order", label: "Pesanan Saya", icon: ClipboardList }, // opsional
      { href: "/customer/notifications", label: "Notifikasi", icon: Bell }, // opsional
      { href: "/customer/settings", label: "Pengaturan", icon: Settings }, // opsional
    ],
    []
  );

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const itemClass = (active: boolean) =>
    [
      "flex items-center gap-3 rounded-lg px-3 py-2 transition",
      active ? "bg-emerald-600 text-white" : "text-gray-700 hover:bg-gray-100",
    ].join(" ");

  return (
    <>
      {/* Topbar mobile */}
      <div className="fixed md:hidden top-0 inset-x-0 h-14 bg-white border-b z-[6000] flex items-center px-4 justify-between">
        <button
          aria-label="Buka menu"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-md p-2 border hover:bg-gray-50"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-sm font-semibold">B-Go • Customer</div>
        <div className="w-9 h-9 rounded-full overflow-hidden border">
          <img
            src={
              session?.user?.image ??
              "https://ui-avatars.com/api/?name=Customer"
            }
            alt="avatar"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Overlay drawer (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-[5000] md:hidden bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel (mobile) */}
      <aside
        className={`fixed z-[7000] md:hidden top-0 left-0 h-full w-64 bg-white border-r transform transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="h-14 border-b px-4 flex items-center justify-between">
          <span className="font-semibold">B-Go Customer</span>
          <button
            aria-label="Tutup menu"
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center rounded-md p-2 border hover:bg-gray-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 space-y-1">
          {nav.map((it) => {
            const Icon = it.icon;
            const active = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={itemClass(active)}
                onClick={() => setOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{it.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-white">
          <button
            onClick={() => signOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-64 bg-white border-r z-30">
        <div className="flex flex-col w-full">
          <div className="h-16 border-b px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">
                  B-Go Customer
                </div>
                <div className="text-[11px] text-gray-500 -mt-0.5">
                  {session?.user?.name ?? "Pengguna"}
                </div>
              </div>
            </div>
          </div>

          <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
            {nav.map((it) => {
              const Icon = it.icon;
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={itemClass(active)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{it.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t">
            <button
              onClick={() => signOut()}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Keluar
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
