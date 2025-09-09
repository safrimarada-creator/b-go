"use client";

import { useEffect, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

interface GoogleMapViewProps {
  center?: LatLng;
  pickup?: LatLng | null;
  destination?: LatLng | null;
  onMapClick?: (coords: LatLng) => void;
  onPickupDrag?: (coords: LatLng) => void;
  onDestinationDrag?: (coords: LatLng) => void;

  // NEW: directions
  drawRoute?: boolean;
  onRouteComputed?: (
    info: {
      distanceText: string;
      durationText: string;
      distanceValue: number; // meters
      durationValue: number; // seconds
    } | null
  ) => void;
}

export default function GoogleMapView({
  center,
  pickup,
  destination,
  onMapClick,
  onPickupDrag,
  onDestinationDrag,
  drawRoute = false,
  onRouteComputed,
}: GoogleMapViewProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);

  const mapClickListenerRef = useRef<google.maps.MapsEventListener | null>(
    null
  );
  const pickupDragListenerRef = useRef<google.maps.MapsEventListener | null>(
    null
  );
  const destDragListenerRef = useRef<google.maps.MapsEventListener | null>(
    null
  );

  // NEW: directions refs
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(
    null
  );
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(
    null
  );

  // Init map
  useEffect(() => {
    if (
      mapDivRef.current &&
      !map &&
      typeof window !== "undefined" &&
      window.google?.maps
    ) {
      const m = new google.maps.Map(mapDivRef.current, {
        center: center || { lat: -1.25, lng: 124.45 }, // Bolsel
        zoom: 14,
        clickableIcons: false,
      });
      setMap(m);
    }
  }, [map, center]);

  // Update center
  useEffect(() => {
    if (map && center) map.setCenter(center);
  }, [map, center]);

  // Handle map click
  useEffect(() => {
    if (!map) return;
    if (mapClickListenerRef.current) {
      mapClickListenerRef.current.remove();
      mapClickListenerRef.current = null;
    }
    if (onMapClick) {
      mapClickListenerRef.current = map.addListener(
        "click",
        (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      );
    }
    return () => {
      if (mapClickListenerRef.current) {
        mapClickListenerRef.current.remove();
        mapClickListenerRef.current = null;
      }
    };
  }, [map, onMapClick]);

  // Pickup marker (draggable)
  useEffect(() => {
    if (!map) return;

    if (pickup) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = new google.maps.Marker({
          map,
          position: pickup,
          draggable: true,
          title: "Penjemputan",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#22c55e",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#166534",
          },
        });
        pickupDragListenerRef.current = pickupMarkerRef.current.addListener(
          "dragend",
          (e) => {
            const ll = (e as google.maps.MapMouseEvent).latLng;
            if (!ll) return;
            onPickupDrag?.({ lat: ll.lat(), lng: ll.lng() });
          }
        );
      } else {
        pickupMarkerRef.current.setPosition(pickup);
      }
    } else if (pickupMarkerRef.current) {
      if (pickupDragListenerRef.current) {
        pickupDragListenerRef.current.remove();
        pickupDragListenerRef.current = null;
      }
      pickupMarkerRef.current.setMap(null);
      pickupMarkerRef.current = null;
    }
  }, [map, pickup, onPickupDrag]);

  // Destination marker (draggable)
  useEffect(() => {
    if (!map) return;

    if (destination) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = new google.maps.Marker({
          map,
          position: destination,
          draggable: true,
          title: "Tujuan",
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 5,
            fillColor: "#7c3aed",
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: "#4c1d95",
          },
        });
        destDragListenerRef.current = destMarkerRef.current.addListener(
          "dragend",
          (e) => {
            const ll = (e as google.maps.MapMouseEvent).latLng;
            if (!ll) return;
            onDestinationDrag?.({ lat: ll.lat(), lng: ll.lng() });
          }
        );
      } else {
        destMarkerRef.current.setPosition(destination);
      }
    } else if (destMarkerRef.current) {
      if (destDragListenerRef.current) {
        destDragListenerRef.current.remove();
        destDragListenerRef.current = null;
      }
      destMarkerRef.current.setMap(null);
      destMarkerRef.current = null;
    }
  }, [map, destination, onDestinationDrag]);

  // NEW: Directions - compute & render route
  useEffect(() => {
    if (!map) return;

    // create service/renderer once
    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new google.maps.DirectionsService();
    }
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        suppressMarkers: true, // kita pakai marker custom sendiri
        polylineOptions: {
          strokeColor: "#10b981", // emerald
          strokeOpacity: 0.9,
          strokeWeight: 5,
        },
      });
      directionsRendererRef.current.setMap(map);
    }

    const svc = directionsServiceRef.current!;
    const rdr = directionsRendererRef.current!;

    // If no need to draw or missing points → clear
    if (!drawRoute || !pickup || !destination) {
      rdr.setDirections({ routes: [] } as any);
      onRouteComputed?.(null);
      return;
    }

    svc.route(
      {
        origin: pickup,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (res, status) => {
        if (
          status === "OK" &&
          res &&
          res.routes &&
          res.routes[0] &&
          res.routes[0].legs[0]
        ) {
          rdr.setDirections(res);
          const leg = res.routes[0].legs[0];
          onRouteComputed?.({
            distanceText: leg.distance?.text || "-",
            durationText: leg.duration?.text || "-",
            distanceValue: leg.distance?.value || 0,
            durationValue: leg.duration?.value || 0,
          });
        } else {
          // clear if failed
          rdr.setDirections({ routes: [] } as any);
          onRouteComputed?.(null);
          // console.warn("Directions failed:", status, res);
        }
      }
    );

    return () => {
      // keep renderer attached; cleanup handled above when conditions change
    };
  }, [map, drawRoute, pickup, destination, onRouteComputed]);

  return (
    <div
      ref={mapDivRef}
      className="w-full h-64 md:h-96 rounded-lg border border-gray-300"
    />
  );
}
