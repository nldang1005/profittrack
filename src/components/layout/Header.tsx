"use client";

import { useEffect, useRef, useState } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { CalendarDays, RefreshCw, Store, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const DATE_RANGES = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "last7" },
  { label: "Last 30 days", value: "last30" },
  { label: "This month", value: "thisMonth" },
  { label: "Last month", value: "lastMonth" },
  { label: "Custom range", value: "custom" },
];

interface HeaderProps {
  storeName?: string;
  onDateRangeChange?: (from: string, to: string, label: string) => void;
  onSync?: () => void;
  syncing?: boolean;
}

export default function Header({
  storeName,
  onDateRangeChange,
  onSync,
  syncing,
}: HeaderProps) {
  const [selectedRange, setSelectedRange] = useState("last30");
  const [showDropdown, setShowDropdown] = useState(false);
  const [customFrom, setCustomFrom] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function applyRange(value: string) {
    if (value === "custom") {
      setSelectedRange("custom");
      return;
    }

    const today = new Date();
    let from: Date, to: Date;

    switch (value) {
      case "today":
        from = to = today;
        break;
      case "yesterday":
        from = to = subDays(today, 1);
        break;
      case "last7":
        from = subDays(today, 6);
        to = today;
        break;
      case "thisMonth":
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case "lastMonth":
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      default: // last30
        from = subDays(today, 29);
        to = today;
    }

    setSelectedRange(value);
    setShowDropdown(false);
    const label = DATE_RANGES.find((r) => r.value === value)?.label || "Last 30 days";
    onDateRangeChange?.(format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd"), label);
  }

  function applyCustomRange() {
    if (!customFrom || !customTo || customFrom > customTo) return;
    setShowDropdown(false);
    const label = `${format(new Date(customFrom), "dd/MM/yyyy")} – ${format(new Date(customTo), "dd/MM/yyyy")}`;
    onDateRangeChange?.(customFrom, customTo, label);
  }

  const currentLabel =
    selectedRange === "custom"
      ? `${format(new Date(customFrom), "dd/MM")} – ${format(new Date(customTo), "dd/MM")}`
      : DATE_RANGES.find((r) => r.value === selectedRange)?.label;

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Store name */}
      <div className="flex items-center gap-2 text-gray-600">
        <Store className="h-4 w-4" />
        <span className="text-sm font-medium">{storeName || "No store connected"}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Date range picker */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <CalendarDays className="h-4 w-4 text-gray-500" />
            {currentLabel}
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {DATE_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => applyRange(range.value)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                    selectedRange === range.value
                      ? "font-medium text-indigo-600"
                      : "text-gray-700"
                  }`}
                >
                  {range.label}
                </button>
              ))}

              {selectedRange === "custom" && (
                <div className="border-t border-gray-100 px-3 py-3 space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">From</label>
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">To</label>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom}
                      max={format(new Date(), "yyyy-MM-dd")}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={applyCustomRange}
                    disabled={!customFrom || !customTo || customFrom > customTo}
                  >
                    Apply
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sync button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={syncing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync"}
        </Button>
      </div>
    </header>
  );
}
