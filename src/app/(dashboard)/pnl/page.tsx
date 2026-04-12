"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";

interface PnLData {
  storeName: string;
  currency: string;
  dateLabel: string;
  // Income
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  // COGS & Expenses
  cogs: number;
  shippingCost: number;
  transactionFees: number;
  adSpend: number;
  otherExpenses: number;
  // Profits
  grossProfit: number;
  grossMargin: number;
  netProfit: number;
  netMargin: number;
  // Breakdown by week
  weeklyData: {
    week: string;
    revenue: number;
    cogs: number;
    adSpend: number;
    netProfit: number;
  }[];
}

function Row({
  label,
  value,
  currency,
  bold,
  indent,
  highlight,
  percent,
  percentBase,
}: {
  label: string;
  value: number;
  currency: string;
  bold?: boolean;
  indent?: boolean;
  highlight?: "green" | "red";
  percent?: boolean;
  percentBase?: number;
}) {
  const pct = percent && percentBase && percentBase > 0 ? (value / percentBase) * 100 : null;
  return (
    <div
      className={`flex items-center justify-between py-2.5 px-4 ${
        bold ? "bg-gray-50" : ""
      } ${indent ? "pl-8" : ""}`}
    >
      <span className={`text-sm ${bold ? "font-semibold text-gray-900" : "text-gray-600"}`}>
        {label}
      </span>
      <div className="flex items-center gap-4">
        {pct !== null && (
          <span className="text-xs text-gray-400 w-12 text-right">
            {pct.toFixed(1)}%
          </span>
        )}
        <span
          className={`text-sm font-medium w-28 text-right ${
            highlight === "green"
              ? "text-green-600"
              : highlight === "red"
              ? "text-red-600"
              : bold
              ? "text-gray-900"
              : "text-gray-700"
          }`}
        >
          {value < 0 ? `-${formatCurrency(Math.abs(value), currency)}` : formatCurrency(value, currency)}
        </span>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-200 mx-4" />;
}

export default function PnLPage() {
  const [data, setData] = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 29), "yyyy-MM-dd"),
    to: format(new Date(), "yyyy-MM-dd"),
    label: "Last 30 days",
  });

  useEffect(() => {
    async function fetch_() {
      setLoading(true);
      const res = await fetch(`/api/pnl?from=${dateRange.from}&to=${dateRange.to}`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    fetch_();
  }, [dateRange]);

  if (loading || !data) {
    return (
      <div className="flex h-full flex-col">
        <Header storeName="" />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  const currency = data.currency;

  return (
    <div className="flex flex-col h-full">
      <Header
        storeName={data.storeName}
        onDateRangeChange={(from, to, label) => setDateRange({ from, to, label })}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Income Statement */}
          <Card>
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="text-base">Income Statement</CardTitle>
              <p className="text-xs text-gray-400">{dateRange.label}</p>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-gray-100">
              {/* Revenue section */}
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Revenue</p>
              </div>
              <Row label="Gross Revenue" value={data.grossRevenue} currency={currency} indent />
              <Row label="Refunds" value={-data.refunds} currency={currency} indent />
              <Row label="Net Revenue" value={data.netRevenue} currency={currency} bold />

              {/* Expenses */}
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cost of Goods</p>
              </div>
              <Row label="COGS (Product Cost)" value={-data.cogs} currency={currency} indent
                percent percentBase={data.netRevenue} />
              <Row label="Shipping Cost" value={-data.shippingCost} currency={currency} indent
                percent percentBase={data.netRevenue} />
              <Row label="Transaction Fees" value={-data.transactionFees} currency={currency} indent
                percent percentBase={data.netRevenue} />
              <Row
                label="Gross Profit"
                value={data.grossProfit}
                currency={currency}
                bold
                highlight={data.grossProfit >= 0 ? "green" : "red"}
              />

              {/* Marketing */}
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Marketing</p>
              </div>
              <Row label="Ad Spend" value={-data.adSpend} currency={currency} indent
                percent percentBase={data.netRevenue} />
              {data.otherExpenses > 0 && (
                <Row label="Other Expenses" value={-data.otherExpenses} currency={currency} indent
                  percent percentBase={data.netRevenue} />
              )}

              {/* Net profit */}
              <Divider />
              <Row
                label="Net Profit"
                value={data.netProfit}
                currency={currency}
                bold
                highlight={data.netProfit >= 0 ? "green" : "red"}
              />
              <div className="flex justify-between px-4 pb-4 pt-1">
                <span className="text-xs text-gray-400">Net Margin</span>
                <span className={`text-xs font-semibold ${data.netMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {data.netMargin.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Breakdown */}
          <Card>
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="text-base">Weekly Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Week</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase">Revenue</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase">COGS</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase">Ads</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.weeklyData.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700 text-xs">{row.week}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{formatCurrency(row.revenue, currency)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{formatCurrency(row.cogs, currency)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{formatCurrency(row.adSpend, currency)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${row.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(row.netProfit, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
