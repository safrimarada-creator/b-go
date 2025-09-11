// src/components/OSMMapView.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvent,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/osm";

/* =================== Ikon Driver =================== */
const DriverIcons: Record<"bike" | "car2" | "car3", L.Icon> = {
  bike: L.icon({
    iconUrl: "/icons/driver-bike.svg",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  }),
  car2: L.icon({
    iconUrl: "/icons/driver-car2.svg",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  }),
  car3: L.icon({
    iconUrl: "/icons/driver-car3.svg",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  }),
};

/* =================== Pin SVG Berwarna =================== */
function makePin(color: string, label?: string) {
  const html = `
  <svg width="36" height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <!-- badan pin -->
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
      fill="${color}" stroke="white" stroke-width="2"/>
    <!-- lingkaran tengah -->
    <circle cx="12" cy="9" r="4" fill="white"/>
    ${
      label
        ? `<text x="12" y="10.5" text-anchor="middle" font-size="7" font-weight="700" fill="#111827">${label}</text>`
        : ""
    }
  </svg>`;
  return L.divIcon({
    className: "bgo-pin",
    html,
    iconSize: [36, 36],
    iconAnchor: [18, 36], // ujung pin tepat di titik koordinat
    popupAnchor: [0, -32],
  });
}

/* =================== Props =================== */
type Props = {
  variant?: "streets" | "satellite";
  center: LatLng;

  // pickup & waypoint
  pickup?: LatLng | null;
  waypoints?: (LatLng | null)[];
  drawRoute?: boolean;

  // driver (opsional)
  driverMarker?: LatLng | null;
  driverVehicle?: "bike" | "car2" | "car3";

  // interaksi
  onMapClick?: (coords: LatLng) => void;
  onPickupDrag?: (coords: LatLng) => void;
  onWaypointDrag?: (index: number, coords: LatLng) => void;

  // warna pin (opsional)
  pickupPinColor?: string; // default hijau
  destPinColor?: string; // default merah

  // info rute (opsional)
  onRouteComputed?: (info: {
    distanceText: string;
    durationText: string;
    distanceValue: number;
    durationValue: number;
  }) => void;

  height?: number;
};

/* =================== Util kecil =================== */
function humanizeDistance(m: number) {
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}
function humanizeDuration(s: number) {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} mnt`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} j ${r} mnt` : `${h} j`;
}

/* =================== Fit Bounds =================== */
function FitBounds({
  pickup,
  waypoints,
  driver,
}: {
  pickup: LatLng | null | undefined;
  waypoints: (LatLng | null | undefined)[];
  driver: LatLng | null | undefined;
}) {
  const map = useMap();
  const pts = useMemo(() => {
    const arr: LatLng[] = [];
    if (pickup) arr.push(pickup);
    waypoints.forEach((w) => w && arr.push(w));
    if (driver) arr.push(driver);
    return arr;
  }, [pickup, waypoints, driver]);

  useEffect(() => {
    if (pts.length === 0) return;
    const b = L.latLngBounds(pts.map((p) => L.latLng(p.lat, p.lng)));
    map.fitBounds(b, { padding: [24, 24] });
  }, [map, pts]);

  return null;
}

/* =================== Map Click Catcher =================== */
function MapClickCatcher({ onClick }: { onClick?: (c: LatLng) => void }) {
  useMapEvent("click", (e) => {
    onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
  });
  return null;
}

/* =================== Marker Draggable =================== */
function DraggableMarker({
  position,
  onDrag,
  tooltip,
  icon,
}: {
  position: LatLng;
  onDrag: (c: LatLng) => void;
  tooltip?: string;
  icon?: L.Icon | L.DivIcon;
}) {
  const [pos, setPos] = useState(position);
  useEffect(() => setPos(position), [position]);

  return (
    <Marker
      position={[pos.lat, pos.lng]}
      draggable
      icon={icon}
      title={tooltip}
      eventHandlers={{
        dragend: (e: L.LeafletEvent) => {
          const m = e.target as L.Marker;
          const ll = m.getLatLng();
          const c = { lat: ll.lat, lng: ll.lng };
          setPos(c);
          onDrag(c);
        },
      }}
    />
  );
}

/* =================== OSRM Route =================== */
async function osrmRoute(points: LatLng[]): Promise<{
  geometry: LatLng[];
  distance: number;
  duration: number;
} | null> {
  if (points.length < 2) return null;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const route = json?.routes?.[0];
  if (!route) return null;

  const geometry: LatLng[] = route.geometry.coordinates.map(
    ([lon, lat]: [number, number]) => ({ lat, lng: lon })
  );
  return { geometry, distance: route.distance, duration: route.duration };
}

/* =================== Komponen Utama =================== */
export default function OSMMapView({
  variant = "streets",
  center,
  pickup = null,
  waypoints = [],
  drawRoute = true,
  driverMarker = null,
  driverVehicle = "bike",
  onMapClick,
  onPickupDrag,
  onWaypointDrag,
  onRouteComputed,
  pickupPinColor = "#10B981", // emerald-500
  destPinColor = "#EF4444", // red-500
  height = 320,
}: Props) {
  const [routeLine, setRouteLine] = useState<LatLng[] | null>(null);

  // icons
  const pickupIcon = useMemo(
    () => makePin(pickupPinColor, "P"),
    [pickupPinColor]
  );
  const destIconFor = useMemo(
    () => (i: number) => makePin(destPinColor, String(i + 1)),
    [destPinColor]
  );

  // hitung rute via OSRM
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!drawRoute) {
        setRouteLine(null);
        return;
      }
      const pts: LatLng[] = [];
      if (pickup) pts.push(pickup);
      waypoints.forEach((w) => w && pts.push(w));
      if (pts.length < 2) {
        setRouteLine(null);
        return;
      }
      const r = await osrmRoute(pts);
      if (!alive) return;
      if (r) {
        setRouteLine(r.geometry);
        onRouteComputed?.({
          distanceText: humanizeDistance(r.distance),
          durationText: humanizeDuration(r.duration),
          distanceValue: r.distance,
          durationValue: r.duration,
        });
      } else {
        setRouteLine(null);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, JSON.stringify(waypoints), drawRoute]);

  const tileUrl =
    variant === "satellite"
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const tileAttrib =
    variant === "satellite"
      ? "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AeroGRID, IGN, and the GIS User Community"
      : "© OpenStreetMap contributors";

  return (
    <div style={{ height }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={tileUrl} attribution={tileAttrib} />

        <MapClickCatcher onClick={onMapClick} />
        <FitBounds
          pickup={pickup}
          waypoints={waypoints}
          driver={driverMarker}
        />

        {/* pickup (hijau) */}
        {pickup && (
          <DraggableMarker
            position={pickup}
            onDrag={(c) => onPickupDrag?.(c)}
            tooltip="Penjemputan"
            icon={pickupIcon}
          />
        )}

        {/* tujuan (merah + nomor urut) */}
        {waypoints.map((wp, idx) =>
          wp ? (
            <DraggableMarker
              key={idx}
              position={wp}
              onDrag={(c) => onWaypointDrag?.(idx, c)}
              tooltip={`Tujuan #${idx + 1}`}
              icon={destIconFor(idx)}
            />
          ) : null
        )}

        {/* driver */}
        {driverMarker && (
          <Marker
            position={[driverMarker.lat, driverMarker.lng]}
            icon={DriverIcons[driverVehicle]}
            title="Driver"
            // zIndexOffset lebih tinggi dari pin tujuan
            zIndexOffset={600}
          />
        )}

        {/* garis rute */}
        {routeLine && (
          <Polyline
            positions={routeLine.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: "#16a34a", weight: 5, opacity: 0.85 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
