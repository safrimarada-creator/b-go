"use client";

import SidebarDriver from "@/components/SidebarDriver";
import { useDriverPresence } from "@/lib/driverPresence";
import dynamic from "next/dynamic";
import { ToggleLeft, ToggleRight, MapPin } from "lucide-react";
import { useSession } from "next-auth/react";

const OSMMapView = dynamic(() => import("@/components/OSMMapView"), {
  ssr: false,
});

export default function DriverDashboardPage() {
  const { data: session } = useSession();
  const { online, setOnline, myLoc } = useDriverPresence();

  return (
    <div className="flex flex-col md:flex-row ">
      <SidebarDriver />

      <main className="flex-1 p-6 pt-20 md:pt-6 md:ml-64">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Driver • Dashboard</h1>
          <button
            onClick={() => setOnline(!online)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
              online ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-800"
            }`}
            title={online ? "Matikan Online" : "Aktifkan Online"}
          >
            {online ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            {online ? "Online" : "Offline"}
          </button>
        </div>

        <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          <span>
            {myLoc
              ? `Lokasi: ${myLoc.lat.toFixed(5)}, ${myLoc.lng.toFixed(5)}`
              : "Lokasi belum tersedia"}
          </span>
        </div>

        <div className="rounded-xl overflow-hidden shadow">
          <OSMMapView
            variant="streets"
            center={myLoc || { lat: -1.25, lng: 124.45 }}
            pickup={null}
            waypoints={[]}
            drawRoute={false}
            driverMarker={myLoc || null}
          />
        </div>
      </main>
    </div>
  );
}
