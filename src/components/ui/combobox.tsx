"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Loader2, Plus } from "lucide-react";

export interface ComboboxOption {
  value: string;       // id
  label: string;       // primary display label
  sublabel?: string;   // secondary info (city, country, etc.)
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;                          // selected id
  onSelect: (option: ComboboxOption) => void;
  onSearch?: (query: string) => void;     // called on input change (for async search)
  onAddNew?: (name: string) => void;      // called when user clicks "Add new"
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  addNewLabel?: string;
}

// Fuzzy match: checks if all chars of query appear in label in order (case-insensitive)
function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  // Exact match wins
  if (t === q) return 100;
  // Starts-with wins
  if (t.startsWith(q)) return 80;
  // Contains wins over fuzzy
  if (t.includes(q)) return 60;
  return 10;
}

export function Combobox({
  options,
  value,
  onSelect,
  onSearch,
  onAddNew,
  placeholder = "Search...",
  loading = false,
  disabled = false,
  className,
  addNewLabel = "Add new",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Selected option label for display
  const selectedOption = options.find((o) => o.value === value);
  const displayValue = open ? query : (selectedOption?.label ?? "");

  // Filter locally — if onSearch provided, server does filtering so show all
  const filtered = onSearch
    ? options
    : options
        .filter((o) => fuzzyMatch(query, o.label) || fuzzyMatch(query, o.sublabel ?? ""))
        .sort((a, b) => fuzzyScore(query, b.label) - fuzzyScore(query, a.label));

  // Show "add new" entry if there's a query and no exact match
  const showAddNew = !!onAddNew && query.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === query.toLowerCase());

  const totalItems = filtered.length + (showAddNew ? 1 : 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setHighlighted(0);
    setOpen(true);
    onSearch?.(v);
  };

  const handleSelect = (option: ComboboxOption) => {
    setQuery("");
    setOpen(false);
    onSelect(option);
  };

  const handleAddNew = () => {
    const name = query.trim();
    setQuery("");
    setOpen(false);
    onAddNew?.(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted < filtered.length) {
        if (filtered[highlighted]) handleSelect(filtered[highlighted]);
      } else if (showAddNew) {
        handleAddNew();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleTriggerClick = () => {
    if (disabled) return;
    setOpen((o) => !o);
    if (!open) setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger / input */}
      <div
        className={cn(
          "flex items-center border border-input rounded-md bg-background shadow-sm transition-colors",
          open && "ring-1 ring-ring",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Input
          ref={inputRef}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => { setOpen(true); if (selectedOption) setQuery(""); }}
          onKeyDown={handleKeyDown}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          disabled={disabled}
          className="border-0 shadow-none ring-0 focus-visible:ring-0 flex-1"
        />
        <button
          type="button"
          onClick={handleTriggerClick}
          className="px-2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
          disabled={disabled}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          )}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-hidden flex flex-col">
          <ul ref={listRef} className="overflow-y-auto flex-1">
            {filtered.length === 0 && !showAddNew && (
              <li className="px-3 py-6 text-center text-sm text-gray-400">
                {loading ? "Searching..." : "No matches found"}
              </li>
            )}
            {filtered.map((option, idx) => (
              <li
                key={option.value}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm",
                  idx === highlighted ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                )}
                onMouseEnter={() => setHighlighted(idx)}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(option); }}
              >
                <Check className={cn("h-3.5 w-3.5 flex-shrink-0", value === option.value ? "opacity-100 text-blue-600" : "opacity-0")} />
                <div className="min-w-0">
                  <span className="font-medium">{option.label}</span>
                  {option.sublabel && (
                    <span className="text-gray-400 ml-2 text-xs truncate">{option.sublabel}</span>
                  )}
                </div>
              </li>
            ))}
            {showAddNew && (
              <li
                className={cn(
                  "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm border-t border-gray-100",
                  highlighted === filtered.length ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-600"
                )}
                onMouseEnter={() => setHighlighted(filtered.length)}
                onMouseDown={(e) => { e.preventDefault(); handleAddNew(); }}
              >
                <Plus className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <span>{addNewLabel}: <strong>"{query.trim()}"</strong></span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
