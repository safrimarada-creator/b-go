"use client";

import { useEffect, useRef, useState } from "react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Camera, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { auth } from "@/lib/firebase";
type Props = {
  value: string | null; // downloadURL tersimpan
  onChange: (url: string | null) => void;
  pathPrefix: string; // contoh: `merchants/tmp` atau `merchants/<docId>`
  label?: string;
};

export default function ImageUploader({
  value,
  onChange,
  pathPrefix,
  label = "Foto / Logo",
}: Props) {
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [progress, setProgress] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setPreview(value ?? null), [value]);

  async function compressImage(
    file: File,
    maxW = 1280,
    quality = 0.8
  ): Promise<Blob> {
    const img = document.createElement("img");
    const reader = new FileReader();
    const done = new Promise<Blob>((resolve, reject) => {
      reader.onload = () => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, maxW / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            "image/jpeg",
            quality
          );
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
    });
    reader.readAsDataURL(file);
    return await done;
  }

  async function handleSelect(file: File) {
    // preview lokal dulu
    setPreview(URL.createObjectURL(file));
    setProgress(1);

    // kompres
    const blob = await compressImage(file);

    // upload

    const filename = `${Date.now()}.jpg`;
    const uid = auth.currentUser?.uid || "public";
    const storageRef = ref(storage, `${pathPrefix}/${filename}`);
    const task = uploadBytesResumable(storageRef, blob, {
      contentType: "image/jpeg",
    });

    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (s) => {
          setProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100));
        },
        reject,
        () => resolve()
      );
    });

    const url = await getDownloadURL(storageRef);
    onChange(url);
    setProgress(100);
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function clearImage() {
    setPreview(null);
    onChange(null);
    setProgress(0);
  }

  return (
    <div>
      <label className="label-xs">{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-28 h-28 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-gray-400" />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openFilePicker}
              className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50"
            >
              <Upload className="w-4 h-4 inline mr-1" />
              Pilih Foto
            </button>

            {/* Kamera (mobile akan muncul opsi kamera) */}
            <label className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50 cursor-pointer">
              <Camera className="w-4 h-4 inline mr-1" />
              Kamera
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) =>
                  e.target.files && handleSelect(e.target.files[0])
                }
              />
            </label>

            {preview && (
              <button
                type="button"
                onClick={clearImage}
                className="px-3 py-2 rounded-md border text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 inline mr-1" />
                Hapus
              </button>
            )}
          </div>

          {progress > 0 && progress < 100 && (
            <div className="text-[11px] text-gray-600">
              Mengunggah… {progress}%
            </div>
          )}
          {preview && (
            <div className="text-[11px] text-gray-500 break-all max-w-[360px]">
              URL: {value || "(belum selesai unggah)"}
            </div>
          )}
        </div>
      </div>

      {/* file picker standar */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files && handleSelect(e.target.files[0])}
      />
    </div>
  );
}
