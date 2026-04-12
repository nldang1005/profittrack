"use client";

import { formatCurrency } from "@/lib/utils";

interface Segment {
  label: string;
  value: number;
  color: string;
  hatched?: boolean;
}

interface BreakevenBarProps {
  aov: number;
  cogs: number;
  shipping: number;
  fees: number;
  adSpend: number;
  netProfit: number;
  currency: string;
}

export default function BreakevenBar({
  aov,
  cogs,
  shipping,
  fees,
  adSpend,
  netProfit,
  currency,
}: BreakevenBarProps) {
  if (!aov || aov <= 0) return null;

  const round = (v: number) => Math.round(v * 100) / 100;

  const cogsPerOrder = round(cogs);
  const shippingPerOrder = round(shipping);
  const feesPerOrder = round(fees);
  const adSpendPerOrder = round(adSpend);
  const profitPerOrder = round(aov - cogsPerOrder - shippingPerOrder - feesPerOrder - adSpendPerOrder);
  const breakeven = round(aov - profitPerOrder);

  const segments: Segment[] = [
    { label: "COGS", value: cogsPerOrder, color: "#f59e0b" },
    { label: "Shipping", value: shippingPerOrder, color: "#a855f7" },
    { label: "Fees", value: feesPerOrder, color: "#10b981" },
    { label: "Ad Spend", value: adSpendPerOrder, color: "#60a5fa" },
    { label: "Profit", value: profitPerOrder, color: "#22c55e", hatched: true },
  ].filter((s) => s.value > 0);

  const breakevenPct = (breakeven / aov) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Average Order: <span className="font-semibold text-gray-800">{formatCurrency(aov, currency)}</span></span>
        {profitPerOrder > 0 && (
          <span className="text-green-600 font-medium">
            Profit/order: {formatCurrency(profitPerOrder, currency)}
          </span>
        )}
        {profitPerOrder <= 0 && (
          <span className="text-red-500 font-medium">
            Loss/order: {formatCurrency(profitPerOrder, currency)}
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="relative h-10 w-full overflow-hidden rounded-lg flex">
        {segments.map((seg, i) => {
          const pct = (seg.value / aov) * 100;
          return (
            <div
              key={i}
              className="relative group flex items-center justify-center overflow-hidden"
              style={{ width: `${pct}%`, backgroundColor: seg.color, minWidth: pct > 1 ? 2 : 0 }}
            >
              {seg.hatched && (
                <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#hatch)" />
                </svg>
              )}
              {pct > 6 && (
                <span className="relative z-10 text-xs font-semibold text-white drop-shadow select-none">
                  {formatCurrency(seg.value, currency)}
                </span>
              )}
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                <div className="rounded bg-gray-900 px-2 py-1 text-xs text-white whitespace-nowrap shadow">
                  {seg.label}: {formatCurrency(seg.value, currency)}
                </div>
                <div className="h-1.5 w-1.5 rotate-45 bg-gray-900 -mt-1" />
              </div>
            </div>
          );
        })}

        {/* Breakeven marker */}
        {profitPerOrder > 0 && (
          <div
            className="absolute top-0 h-full z-10 pointer-events-none"
            style={{ left: `${breakevenPct}%` }}
          >
            <div className="relative h-full">
              <div className="absolute inset-y-0 w-0.5 bg-gray-800 opacity-80" />
              <div className="absolute -top-7 left-1 whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-xs text-white shadow">
                Breakeven at {formatCurrency(breakeven, currency)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Labels */}
      <div className="flex w-full text-xs text-gray-500">
        {segments.map((seg, i) => {
          const pct = (seg.value / aov) * 100;
          return (
            <div key={i} style={{ width: `${pct}%` }} className="overflow-hidden">
              {pct > 5 && (
                <span className="block truncate">{formatCurrency(seg.value, currency)}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-gray-500">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
