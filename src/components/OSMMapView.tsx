// src/components/OSMMapView.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvent,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/osm";

// Default icon (untuk pickup/waypoint)
const DefaultIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// 🔹 ikon kendaraan driver
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

type Props = {
  variant: "streets" | "satellite";
  center: LatLng;
  pickup: LatLng | null;
  waypoints: (LatLng | null)[];
  drawRoute?: boolean;

  // ✅ posisi & jenis kendaraan driver
  driverMarker?: LatLng | null;
  driverVehicle?: "bike" | "car2" | "car3";

  onMapClick?: (coords: LatLng) => void;
  onPickupDrag?: (coords: LatLng) => void;
  onWaypointDrag?: (index: number, coords: LatLng) => void;
  onRouteComputed?: (info: {
    distanceText: string;
    durationText: string;
    distanceValue: number;
    durationValue: number;
  }) => void;

  height?: number;
};

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

function FitBounds({
  pickup,
  waypoints,
  driver,
}: {
  pickup: LatLng | null;
  waypoints: (LatLng | null)[];
  driver: LatLng | null;
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

function MapClickCatcher({ onClick }: { onClick?: (c: LatLng) => void }) {
  useMapEvent("click", (e) => {
    onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
  });
  return null;
}

function DraggableMarker({
  position,
  onDrag,
  tooltip,
}: {
  position: LatLng;
  onDrag: (c: LatLng) => void;
  tooltip?: string;
}) {
  const [pos, setPos] = useState(position);
  useEffect(() => setPos(position), [position]);
  const ref = useRef<L.Marker>(null);

  return (
    <Marker
      position={[pos.lat, pos.lng]}
      draggable
      eventHandlers={{
        dragend: () => {
          const p = ref.current?.getLatLng();
          if (p) {
            const c = { lat: p.lat, lng: p.lng };
            setPos(c);
            onDrag(c);
          }
        },
      }}
      ref={ref as any}
      title={tooltip}
    />
  );
}

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

export default function OSMMapView({
  variant,
  center,
  pickup,
  waypoints,
  drawRoute = true,
  driverMarker = null,
  driverVehicle = "bike",
  onMapClick,
  onPickupDrag,
  onWaypointDrag,
  onRouteComputed,
  height = 320,
}: Props) {
  const [routeLine, setRouteLine] = useState<LatLng[] | null>(null);

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

        {/* pickup */}
        {pickup && (
          <DraggableMarker
            position={pickup}
            onDrag={(c) => onPickupDrag?.(c)}
            tooltip="Penjemputan"
          />
        )}

        {/* tujuan */}
        {waypoints.map((wp, idx) =>
          wp ? (
            <DraggableMarker
              key={idx}
              position={wp}
              onDrag={(c) => onWaypointDrag?.(idx, c)}
              tooltip={`Tujuan #${idx + 1}`}
            />
          ) : null
        )}

        {/* driver */}
        {driverMarker && (
          <Marker
            position={[driverMarker.lat, driverMarker.lng]}
            icon={DriverIcons[driverVehicle]}
            title="Driver"
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
