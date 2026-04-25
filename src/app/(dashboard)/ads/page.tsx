"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, XCircle, Zap, ArrowUpRight, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/layout/Header";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

interface Campaign {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number;
  color: string;
}

interface Insight {
  overallTrend: "improving" | "declining" | "stable";
  trendDelta: number;
  lastDataDay: string | null;
  activeCampaigns: { campaignId: string; campaignName: string; roas: number; spend: number; purchases: number; status: string; color: string }[];
  recommendations: { type: string; campaign: string; message: string }[];
}

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
  campaigns: Campaign[];
  dailySpend: { date: string; spend: number; revenue: number }[];
  dailyByCampaign: Record<string, any>[];
  topCampaigns: { campaignId: string; campaignName: string; color: string }[];
  insights: Insight | null;
}

const STATUS_CONFIG = {
  excellent: { label: "Xuất sắc", bg: "bg-green-100", text: "text-green-700", icon: CheckCircle },
  good:      { label: "Tốt",      bg: "bg-blue-100",  text: "text-blue-700",  icon: TrendingUp },
  warning:   { label: "Cần tối ưu", bg: "bg-yellow-100", text: "text-yellow-700", icon: AlertTriangle },
  danger:    { label: "Đang lỗ",  bg: "bg-red-100",   text: "text-red-700",   icon: XCircle },
  inactive:   { label: "Không active", bg: "bg-gray-100",  text: "text-gray-500",  icon: Minus },
  monitoring: { label: "Theo dõi",     bg: "bg-blue-50",  text: "text-blue-600",  icon: Eye },
};

const REC_CONFIG = {
  scale:    { bg: "bg-green-50 border-green-200",  icon: ArrowUpRight, iconColor: "text-green-600" },
  optimize: { bg: "bg-yellow-50 border-yellow-200", icon: Zap,          iconColor: "text-yellow-600" },
  pause:    { bg: "bg-red-50 border-red-200",       icon: XCircle,      iconColor: "text-red-600" },
  alert:      { bg: "bg-orange-50 border-orange-200", icon: AlertTriangle, iconColor: "text-orange-600" },
  positive:   { bg: "bg-green-50 border-green-200",  icon: TrendingUp,   iconColor: "text-green-600" },
  monitoring: { bg: "bg-blue-50 border-blue-200",    icon: Eye,          iconColor: "text-blue-500"  },
  scale_up:   { bg: "bg-indigo-50 border-indigo-200", icon: TrendingUp,  iconColor: "text-indigo-600" },
};

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

  useEffect(() => { loadData(); }, [dateRange]);

  async function handleSync() {
    setSyncing(true);
    await fetch("/api/facebook/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: dateRange.from, to: dateRange.to }),
    });
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
  const insights = data.insights;

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
              {insights && (
                <p className={`text-xs mt-0.5 font-medium flex items-center gap-1 ${
                  insights.overallTrend === "improving" ? "text-green-600" :
                  insights.overallTrend === "declining" ? "text-red-500" : "text-gray-400"
                }`}>
                  {insights.overallTrend === "improving" ? <TrendingUp className="h-3 w-3" /> :
                   insights.overallTrend === "declining" ? <TrendingDown className="h-3 w-3" /> :
                   <Minus className="h-3 w-3" />}
                  {insights.overallTrend === "improving" ? `+${insights.trendDelta.toFixed(2)} so với nửa đầu` :
                   insights.overallTrend === "declining" ? `${insights.trendDelta.toFixed(2)} so với nửa đầu` :
                   "Ổn định"}
                </p>
              )}
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
            <CardTitle className="text-base">Chi tiêu & Doanh thu theo ngày</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.dailySpend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v), currency)} contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} />
                <Bar dataKey="spend"   name="Ad Spend" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="revenue" name="Revenue"  fill="#6366f1" radius={[3, 3, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ROAS by Campaign (daily line chart) */}
        {data.dailyByCampaign?.length > 0 && data.topCampaigns?.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ROAS theo ngày — từng chiến dịch</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.dailyByCampaign} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}x`} />
                  <Tooltip
                    formatter={(v: any) => v != null ? [`${Number(v).toFixed(2)}x`, "ROAS"] : ["—", "ROAS"]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Legend formatter={(value) => {
                    const c = data.topCampaigns.find(c => c.campaignId === value);
                    return <span className="text-xs">{c?.campaignName?.slice(0, 24) || value}</span>;
                  }} />
                  {data.topCampaigns.map((c) => (
                    <Line
                      key={c.campaignId}
                      type="monotone"
                      dataKey={c.campaignId}
                      stroke={c.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Insights & Recommendations */}
        {insights && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active campaigns status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                Campaigns đang active
                {insights.lastDataDay && (
                  <span className="ml-2 text-xs font-normal text-gray-400">· dữ liệu {insights.lastDataDay}</span>
                )}
              </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {insights.activeCampaigns.length === 0 ? (
                  <p className="text-sm text-gray-400">Không có campaign nào active trong 4 ngày qua.</p>
                ) : (
                  insights.activeCampaigns.map((c) => {
                    const cfg = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.inactive;
                    const Icon = cfg.icon;
                    return (
                      <div key={c.campaignId} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <p className="text-xs font-medium text-gray-800 truncate max-w-44">{c.campaignName}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-gray-600">${c.spend.toFixed(0)}</span>
                          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                            <Icon className="h-3 w-3" />
                            {c.roas.toFixed(2)}x
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nhận xét & Khuyến nghị</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {insights.recommendations.length === 0 ? (
                  <p className="text-sm text-gray-400">Hiệu suất ổn định, tiếp tục theo dõi.</p>
                ) : (
                  insights.recommendations.map((r, i) => {
                    const cfg = REC_CONFIG[r.type as keyof typeof REC_CONFIG] || REC_CONFIG.optimize;
                    const Icon = cfg.icon;
                    return (
                      <div key={i} className={`rounded-lg border p-3 ${cfg.bg}`}>
                        <div className="flex items-start gap-2">
                          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.iconColor}`} />
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{r.campaign}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{r.message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Campaigns Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tất cả chiến dịch</CardTitle>
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
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                            <p className="font-medium text-gray-900 text-xs line-clamp-1 max-w-52">{c.campaignName || c.campaignId}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{formatCurrency(c.spend, currency)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(c.revenue, currency)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${c.roas >= 2.5 ? "text-green-600" : c.roas >= 1.5 ? "text-blue-600" : c.roas >= 1 ? "text-yellow-600" : "text-red-600"}`}>
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
