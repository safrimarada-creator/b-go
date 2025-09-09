// src/components/SidebarAdmin.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  Menu,
  LayoutGrid,
  CircleDollarSign,
  MapPin,
  Store,
  Package,
  ClipboardList,
  Settings,
} from "lucide-react";

type Props = {
  open?: boolean;
  onClose?: () => void;
};

export default function SidebarAdmin({ open = false, onClose }: Props) {
  const pathname = usePathname();

  const items = [
    { href: "/admin", label: "Dashboard", icon: LayoutGrid },
    { href: "/admin/pricing", label: "Pricing", icon: CircleDollarSign },
    { href: "/admin/driver-online", label: "Driver Online", icon: MapPin },
    { href: "/admin/merchants", label: "Merchants", icon: Store },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/orders", label: "Orders", icon: ClipboardList },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  // sidebar (fixed di kiri). Pada mobile, tampil pakai slide-in.
  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r shadow-sm",
          "transform transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0", // selalu terlihat di md+
        ].join(" ")}
      >
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b">
          <div className="font-semibold">Admin</div>
          <button
            className="md:hidden rounded p-2 hover:bg-gray-100"
            onClick={onClose}
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="p-2 space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                  active
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
                onClick={onClose}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
