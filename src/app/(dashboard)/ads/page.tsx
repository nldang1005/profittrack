"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { Megaphone, TrendingUp, Target, MousePointerClick } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/layout/Header";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AdsData {
  storeName: string;
  currency: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalPurchases: number;
  totalRevenue: number;
  roas: number;
  cpc: number;
  cpa: number;
  cpm: number;
  campaigns: {
    campaignId: string;
    campaignName: string;
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    revenue: number;
    roas: number;
  }[];
  dailySpend: { date: string; spend: number; revenue: number }[];
}

export default function AdsPage() {
  const [data, setData] = useState<AdsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 29), "yyyy-MM-dd"),
    to: format(new Date(), "yyyy-MM-dd"),
    label: "Last 30 days",
  });

  async function loadData() {
    setLoading(true);
    const res = await fetch(`/api/ads?from=${dateRange.from}&to=${dateRange.to}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [dateRange]);

  async function handleSync() {
    setSyncing(true);
    await fetch("/api/facebook/sync", { method: "POST" });
    await loadData();
    setSyncing(false);
  }

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
        onSync={handleSync}
        syncing={syncing}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-gray-500">Total Spend</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{formatCurrency(data.totalSpend, currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-gray-500">ROAS</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{data.roas.toFixed(2)}x</p>
              <p className="text-xs text-gray-400">Revenue per $1 spent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-gray-500">Cost Per Purchase</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{formatCurrency(data.cpa, currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-gray-500">Clicks / Impressions</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{formatNumber(data.totalClicks)}</p>
              <p className="text-xs text-gray-400">{formatNumber(data.totalImpressions)} impressions</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Spend Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily Ad Spend vs Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.dailySpend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v), currency)}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
                />
                <Bar dataKey="spend" name="Ad Spend" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[3, 3, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Campaigns Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Campaign</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Spend</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">ROAS</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Clicks</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Purchases</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">CPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-gray-400">
                        No ad data yet. Connect Facebook Ads and sync.
                      </td>
                    </tr>
                  ) : (
                    data.campaigns.map((c) => (
                      <tr key={c.campaignId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-xs line-clamp-1 max-w-56">{c.campaignName || c.campaignId}</p>
                        </td>
                        <td className="px-4 py-3 text-right">{formatCurrency(c.spend, currency)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(c.revenue, currency)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${c.roas >= 2 ? "text-green-600" : c.roas >= 1 ? "text-yellow-600" : "text-red-600"}`}>
                            {c.roas.toFixed(2)}x
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatNumber(c.clicks)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{c.purchases}</td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {c.purchases > 0 ? formatCurrency(c.spend / c.purchases, currency) : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
