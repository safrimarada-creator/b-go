// src/components/OrderStatusBadge.tsx
"use client";

import clsx from "clsx";

type Props = {
  status:
    | "searching"
    | "assigned"
    | "driver_arriving"
    | "ongoing"
    | "completed"
    | "canceled";
  className?: string;
};

const LABEL: Record<Props["status"], string> = {
  searching: "Mencari Driver",
  assigned: "Driver Ditemukan",
  driver_arriving: "Menuju Pickup",
  ongoing: "Dalam Perjalanan",
  completed: "Selesai",
  canceled: "Dibatalkan",
};

export default function OrderStatusBadge({ status, className }: Props) {
  return (
    <span
      className={clsx(
        "text-[11px] px-2 py-1 rounded-full border",
        status === "searching" && "bg-amber-50 text-amber-800 border-amber-200",
        status === "assigned" && "bg-blue-50 text-blue-800 border-blue-200",
        status === "driver_arriving" &&
          "bg-indigo-50 text-indigo-800 border-indigo-200",
        status === "ongoing" && "bg-green-50 text-green-800 border-green-200",
        status === "completed" &&
          "bg-emerald-50 text-emerald-900 border-emerald-200",
        status === "canceled" && "bg-red-50 text-red-700 border-red-200",
        className
      )}
    >
      {LABEL[status] || status}
    </span>
  );
}
