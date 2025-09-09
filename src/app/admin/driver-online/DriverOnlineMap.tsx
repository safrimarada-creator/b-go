"use client";

import "leaflet/dist/leaflet.css";
import L, { LatLngExpression } from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";

type Row = {
  uid: string;
  name?: string | null;
  email?: string | null;
  coords?: { lat: number; lng: number } | null;
  updatedAt?: any;
};

// Icon Leaflet (agar tampil di Next)
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
(L.Marker as any).prototype.options.icon = defaultIcon;

const greenIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function timeAgo(ts?: any) {
  if (!ts?.toDate) return "-";
  const d = ts.toDate() as Date;
  const diff = Math.max(0, Date.now() - d.getTime());
  const m = Math.round(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  return `${h} jam lalu`;
}

/** Fit bounds setiap jumlah marker berubah (tidak “lompat” tiap koordinat update) */
function FitBoundsOnCount({ points }: { points: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [points.length, map]); // perhatikan: hanya saat JUMLAH berubah
  return null;
}

export default function DriverOnlineMap({ rows }: { rows: Row[] }) {
  const points: LatLngExpression[] = useMemo(
    () =>
      rows
        .filter((r) => r.coords)
        .map((r) => [r.coords!.lat, r.coords!.lng] as LatLngExpression),
    [rows]
  );

  const center: LatLngExpression = points[0] || [-1.25, 124.45]; // Bolsel

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: 420, width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBoundsOnCount points={points} />

      {rows.map((r) =>
        r.coords ? (
          <Marker
            key={r.uid}
            position={[r.coords.lat, r.coords.lng]}
            icon={greenIcon}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{r.name || r.uid}</div>
                <div className="text-xs text-gray-600">{r.email || "-"}</div>
                <div className="mt-1 text-xs">
                  {r.coords.lat.toFixed(5)}, {r.coords.lng.toFixed(5)}
                </div>
                <div className="text-[11px] text-gray-500">
                  Terakhir: {timeAgo(r.updatedAt)}
                </div>
              </div>
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}
