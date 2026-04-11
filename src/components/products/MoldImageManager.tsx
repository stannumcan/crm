"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ImagePlus, Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = "https://lwdxvcrvrzlfetelcemt.supabase.co";
const BUCKET = "quote-attachments";

interface Mold {
  id: string;
  mold_number: string;
  category: string | null;
  variant: string | null;
  dimensions: string | null;
  feature: string | null;
  image_url: string | null;
  is_active: boolean;
}

export default function MoldImageManager({ initialMolds }: { initialMolds: Mold[] }) {
  const [molds, setMolds] = useState<Mold[]>(initialMolds);
  const [uploading, setUploading] = useState<string | null>(null); // mold id being uploaded
  const [selected, setSelected] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingMoldId = useRef<string | null>(null);

  const handleUpload = useCallback(async (moldId: string, file: File) => {
    setUploading(moldId);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `mold-images/${moldId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

      // Save image_url to molds table
      const res = await fetch(`/api/molds/${moldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: url }),
      });
      if (!res.ok) throw new Error("Failed to save image URL");

      setMolds((prev) =>
        prev.map((m) => (m.id === moldId ? { ...m, image_url: url } : m))
      );
    } catch (err) {
      alert("Upload failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(null);
    }
  }, []);

  const handleRemoveImage = useCallback(async (moldId: string) => {
    const res = await fetch(`/api/molds/${moldId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: null }),
    });
    if (res.ok) {
      setMolds((prev) =>
        prev.map((m) => (m.id === moldId ? { ...m, image_url: null } : m))
      );
    }
  }, []);

  const triggerUpload = (moldId: string) => {
    pendingMoldId.current = moldId;
    inputRef.current?.click();
  };

  return (
    <div>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const id = pendingMoldId.current;
          if (f && id) handleUpload(id, f);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {molds.map((mold) => (
          <div
            key={mold.id}
            className={`border rounded-lg overflow-hidden bg-white shadow-sm cursor-pointer transition-shadow ${selected === mold.id ? "ring-2 ring-blue-500" : "hover:shadow-md"}`}
            onClick={() => setSelected(selected === mold.id ? null : mold.id)}
          >
            {/* Image area */}
            <div className="relative bg-gray-50 h-32 flex items-center justify-center">
              {mold.image_url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mold.image_url}
                    alt={mold.mold_number}
                    className="max-h-28 max-w-full object-contain p-1"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveImage(mold.id); }}
                    className="absolute top-1 right-1 bg-white border rounded-full p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <CheckCircle2 className="absolute bottom-1 right-1 h-4 w-4 text-green-500" />
                </>
              ) : (
                <div className="text-center text-gray-300">
                  <ImagePlus className="h-8 w-8 mx-auto mb-1" />
                  <span className="text-xs">No image</span>
                </div>
              )}
              {uploading === mold.id && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-2 border-t">
              <p className="text-xs font-semibold text-gray-800 truncate">{mold.mold_number}</p>
              {mold.category && (
                <p className="text-xs text-gray-500 truncate">{mold.category}</p>
              )}
              {mold.dimensions && (
                <p className="text-xs text-gray-400 truncate">{mold.dimensions}</p>
              )}
            </div>

            {/* Upload button (expanded on select) */}
            {selected === mold.id && (
              <div className="px-2 pb-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full gap-1 text-xs"
                  onClick={() => triggerUpload(mold.id)}
                  disabled={uploading === mold.id}
                >
                  <ImagePlus className="h-3 w-3" />
                  {mold.image_url ? "Change Image" : "Upload Image"}
                </Button>
                {mold.image_url && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full gap-1 text-xs text-red-500 hover:text-red-600 mt-1"
                    onClick={() => handleRemoveImage(mold.id)}
                  >
                    <X className="h-3 w-3" />
                    Remove Image
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {molds.length === 0 && (
        <p className="text-gray-400 text-sm mt-8 text-center">No molds found.</p>
      )}
    </div>
  );
}
