"use client";
import { useDriverPresence } from "@/lib/driverPresence";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { online, setOnline } = useDriverPresence();
  return (
    <div className="flex">
      {/* SidebarDriver kamu di sini */}
      {/* <div className="p-2"> */}
      {/* <button
        onClick={() => setOnline(!online)}
        className={`px-3 py-1 rounded ${
          online ? "bg-emerald-600 text-white" : "bg-gray-200"
        }`}
      >
        {online ? "Online" : "Offline"}
      </button> */}
      {/* </div> */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
