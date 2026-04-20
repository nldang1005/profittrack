"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Megaphone,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Link as LinkIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import RevenueChart from "@/components/charts/RevenueChart";
import SpendBreakdown from "@/components/charts/SpendBreakdown";
import BreakevenBar from "@/components/charts/BreakevenBar";
import Header from "@/components/layout/Header";
import { formatCurrency, formatPercent } from "@/lib/utils";
import Link from "next/link";

interface DashboardData {
  revenue: number;
  cogs: number;
  shipping: number;
  fees: number;
  adSpend: number;
  grossProfit: number;
  netProfit: number;
  netMargin: number;
  roas: number;
  orders: number;
  aov: number;
  currency: string;
  storeName: string;
  chartData: { date: string; revenue: number; cogs: number; adSpend: number; netProfit: number }[];
  spendBreakdown: { name: string; value: number }[];
  topProducts: { title: string; orders: number; revenue: number; profit: number }[];
  hasStore: boolean;
  hasFacebook: boolean;
}

function KpiCard({
  title,
  value,
  change,
  icon: Icon,
  iconColor,
  subtext,
}: {
  title: string;
  value: string;
  change?: number;
  icon: any;
  iconColor: string;
  subtext?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
            {subtext && <p className="mt-0.5 text-xs text-gray-400">{subtext}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {change !== undefined && (
          <div className="mt-3 flex items-center gap-1">
            {change >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className={`text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
              {Math.abs(change).toFixed(1)}% vs prev period
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 29), "yyyy-MM-dd"),
    to: format(new Date(), "yyyy-MM-dd"),
    label: "Last 30 days",
  });

  async function fetchDashboard() {
    try {
      const res = await fetch(
        `/api/dashboard?from=${dateRange.from}&to=${dateRange.to}`
      );
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    await fetch("/api/shopify/sync", { method: "POST" });
    await fetch("/api/facebook/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: dateRange.from, to: dateRange.to }),
    });
    await fetchDashboard();
    setSyncing(false);
  }

  useEffect(() => {
    fetchDashboard();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data?.hasStore) {
    return (
      <div className="flex h-full flex-col">
        <Header storeName="No store" />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
              <LinkIcon className="h-8 w-8 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Connect your Shopify store</h2>
            <p className="mt-2 text-gray-500 text-sm">
              Connect your Shopify store to start tracking revenue, profit, and expenses in real-time.
            </p>
            <Button className="mt-6" asChild>
              <Link href="/settings">Go to Settings</Link>
            </Button>
          </div>
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
        {/* Facebook not connected warning */}
        {!data.hasFacebook && (
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700">
              Facebook Ads not connected. Ad spend data is unavailable.{" "}
              <Link href="/settings" className="font-medium underline">
                Connect now
              </Link>
            </p>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Revenue"
            value={formatCurrency(data.revenue, currency)}
            icon={DollarSign}
            iconColor="bg-indigo-100 text-indigo-600"
            subtext={`${data.orders} orders`}
          />
          <KpiCard
            title="Net Profit"
            value={formatCurrency(data.netProfit, currency)}
            icon={data.netProfit >= 0 ? TrendingUp : TrendingDown}
            iconColor={data.netProfit >= 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}
            subtext={`${data.netMargin.toFixed(1)}% margin`}
          />
          <KpiCard
            title="Ad Spend"
            value={formatCurrency(data.adSpend, currency)}
            icon={Megaphone}
            iconColor="bg-red-100 text-red-600"
            subtext={`ROAS: ${data.roas.toFixed(2)}x`}
          />
          <KpiCard
            title="Avg Order Value"
            value={formatCurrency(data.aov, currency)}
            icon={ShoppingCart}
            iconColor="bg-purple-100 text-purple-600"
            subtext={`${data.orders} total orders`}
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-gray-500 mb-1">Gross Profit</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(data.grossProfit, currency)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {((data.grossProfit / data.revenue) * 100 || 0).toFixed(1)}% margin
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-gray-500 mb-1">COGS</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(data.cogs, currency)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {((data.cogs / data.revenue) * 100 || 0).toFixed(1)}% of revenue
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-gray-500 mb-1">ROAS</p>
              <p className="text-lg font-bold text-gray-900">{data.roas.toFixed(2)}x</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Revenue per $1 ad spend
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Breakeven Bar */}
        {data.orders > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Breakeven Analysis</CardTitle>
              <p className="text-xs text-gray-400">Per-order cost breakdown vs. average order value</p>
            </CardHeader>
            <CardContent className="pt-6">
              <BreakevenBar
                aov={data.aov}
                cogs={data.cogs / data.orders}
                shipping={data.shipping / data.orders}
                fees={data.fees / data.orders}
                adSpend={data.adSpend / data.orders}
                netProfit={data.netProfit / data.orders}
                currency={currency}
              />
            </CardContent>
          </Card>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue & Profit Overview</CardTitle>
              <p className="text-xs text-gray-400">{dateRange.label}</p>
            </CardHeader>
            <CardContent>
              <RevenueChart data={data.chartData} currency={currency} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <SpendBreakdown data={data.spendBreakdown} currency={currency} />
            </CardContent>
          </Card>
        </div>

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Products by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {data.topProducts.length === 0 ? (
                <p className="px-6 py-4 text-sm text-gray-500">No product data yet</p>
              ) : (
                data.topProducts.map((product, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                        <Package className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">{product.title}</p>
                        <p className="text-xs text-gray-400">{product.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(product.revenue, currency)}
                      </p>
                      <p className={`text-xs font-medium ${product.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(product.profit, currency)} profit
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
