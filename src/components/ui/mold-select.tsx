"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Mold {
  id: string;
  mold_number: string;
  dimensions: string | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  category: string | null;
  image_url: string | null;
}

interface Props {
  value: string;
  onChange: (moldNumber: string, dimensions: string, imageUrl: string | null, moldId: string | null) => void;
  placeholder?: string;
}

export default function MoldSelect({ value, onChange, placeholder = "Search mold..." }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Mold[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/molds/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query, open]);

  const handleSelect = (mold: Mold) => {
    const dims = mold.dimensions
      || (mold.length_mm && mold.width_mm && mold.height_mm
        ? `${mold.length_mm}×${mold.width_mm}×${mold.height_mm}mm`
        : "");
    setQuery(mold.mold_number);
    onChange(mold.mold_number, dims, mold.image_url, mold.id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-60 overflow-auto rounded-md border bg-popover shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No molds found</div>
          )}
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-3 transition-colors"
              onClick={() => handleSelect(m)}
            >
              {m.image_url && (
                <img src={m.image_url} alt="" className="h-8 w-8 rounded object-cover bg-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-mono font-medium text-sm">{m.mold_number}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {m.dimensions || `${m.length_mm ?? ""}×${m.width_mm ?? ""}×${m.height_mm ?? ""}mm`}
                  {m.category && ` · ${m.category}`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
