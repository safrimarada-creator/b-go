"use client";

import { useEffect, useState } from "react";
import { GoogleMap, Marker, LoadScript } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "400px",
};

interface LiveTrackingMapProps {
  trackLive?: boolean; // true untuk real-time tracking
}

export default function LiveTrackingMap({
  trackLive = true,
}: LiveTrackingMapProps) {
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(
    null
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      alert("Geolocation tidak didukung oleh browser Anda.");
      return;
    }

    let watchId: number;

    if (trackLive) {
      // Pantau posisi terus-menerus
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.error("Gagal mendapatkan lokasi:", err);
        },
        { enableHighAccuracy: true }
      );
    } else {
      // Ambil posisi sekali saja
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.error("Gagal mendapatkan lokasi:", err);
        }
      );
    }

    // Bersihkan saat komponen dilepas
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [trackLive]);

  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={position || { lat: -1.0, lng: 119.0 }} // default Indonesia Tengah
        zoom={15}
      >
        {position && (
          <Marker
            position={position}
            icon={{
              url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
              scaledSize: new window.google.maps.Size(40, 40),
            }}
          />
        )}
      </GoogleMap>
    </LoadScript>
  );
}
