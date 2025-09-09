// src/components/AutocompleteInputOSM.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { osmSearch } from "@/lib/osm";

interface Props {
  value?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  onChangeText?: (v: string) => void;
  onPlaceSelected: (place: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
}

export default function AutocompleteInputOSM({
  value,
  placeholder,
  icon,
  onChangeText,
  onPlaceSelected,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<
    { label: string; lat: number; lng: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (inputRef.current && typeof value === "string") {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleSearch = (q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q || q.length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await osmSearch(q, "id", 6);
        setItems(results);
        setOpen(true);
      } catch {
        setItems([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div className="relative">
      {/* ikon kecil */}
      {icon && <div className="input-icon-sm">{icon}</div>}

      {/* input kecil */}
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        className="input-sm pl-9"
        onChange={(e) => {
          const v = e.target.value;
          onChangeText?.(v);
          handleSearch(v);
        }}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow max-h-56 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-gray-500">Mencari…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">
              Tidak ada hasil
            </div>
          )}
          {items.map((it, idx) => (
            <button
              key={`${it.lat},${it.lng}-${idx}`}
              type="button"
              className="block w-full text-left px-3 py-2 hover:bg-gray-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPlaceSelected({
                  address: it.label,
                  lat: it.lat,
                  lng: it.lng,
                });
                if (inputRef.current) inputRef.current.value = it.label;
                setOpen(false);
              }}
              title={it.label}
            >
              <div className="text-sm text-gray-800 truncate">{it.label}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
